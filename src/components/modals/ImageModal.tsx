import { useState, useMemo, useEffect } from 'react';
import { Download, Package, Monitor, Terminal, Zap, Star, Layers, Shield, FlaskConical, RefreshCw, AppWindow, Box } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Modal } from './Modal';
import { ErrorDisplay, ListItemSkeleton, ConfirmationDialog } from '../shared';
import type { BoardInfo, ImageInfo, ImageFilterType } from '../../types';
import { getImagesForBoard } from '../../hooks/useTauri';
import { useAsyncDataWhen } from '../../hooks/useAsyncData';
import { useSkeletonLoading } from '../../hooks/useSkeletonLoading';
import {
  getOsInfo,
  getAppInfo,
  getDesktopEnv,
  getKernelType,
  DESKTOP_BADGES,
  KERNEL_BADGES,
  DESKTOP_ENVIRONMENTS,
  UI,
  adjustBrightness,
} from '../../config';
import { formatFileSize, DEFAULT_COLOR } from '../../utils';

interface ImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (image: ImageInfo) => void;
  board: BoardInfo | null;
}

// Trunk / rolling-release builds carry "trunk" in their release version
const isTrunkImage = (img: ImageInfo): boolean => img.release.toLowerCase().includes('trunk');

// Predicates shared by availability checks and filtering
const IMAGE_FILTER_PREDICATES: Record<Exclude<ImageFilterType, 'all'>, (img: ImageInfo) => boolean> = {
  recommended: (img) => img.promoted === true,
  // Exclude trunk so Stable and Rolling stay mutually exclusive
  stable: (img) => img.stability === 'stable' && !isTrunkImage(img),
  nightly: (img) => img.stability === 'nightly',
  rolling: isTrunkImage,
  apps: (img) => !!(img.preinstalled_application && img.preinstalled_application.length > 0),
  // Minimal: no desktop environment and no preinstalled apps
  barebone: (img) => {
    const variant = img.image_variant.toLowerCase();
    const hasDesktop = DESKTOP_ENVIRONMENTS.some(de => variant.includes(de));
    const hasApp = img.preinstalled_application && img.preinstalled_application.length > 0;
    return !hasDesktop && !hasApp;
  },
};

function hasImagesForFilter(images: ImageInfo[], filter: Exclude<ImageFilterType, 'all'>): boolean {
  return images.some(IMAGE_FILTER_PREDICATES[filter]);
}

function applyFilter(images: ImageInfo[], filter: ImageFilterType): ImageInfo[] {
  if (filter === 'all') return images;
  return images.filter(IMAGE_FILTER_PREDICATES[filter]);
}

// Data-driven filter button list
const FILTER_BUTTONS: Array<{
  key: Exclude<ImageFilterType, 'all'>;
  labelKey: string;
  icon: typeof Star;
}> = [
  { key: 'recommended', labelKey: 'modal.promoted', icon: Star },
  { key: 'stable', labelKey: 'modal.stable', icon: Shield },
  { key: 'nightly', labelKey: 'modal.nightly', icon: FlaskConical },
  { key: 'rolling', labelKey: 'modal.rolling', icon: RefreshCw },
  { key: 'apps', labelKey: 'modal.apps', icon: AppWindow },
  { key: 'barebone', labelKey: 'modal.minimal', icon: Box },
];

export function ImageModal({ isOpen, onClose, onSelect, board }: ImageModalProps) {
  const { t } = useTranslation();
  const [filterType, setFilterType] = useState<ImageFilterType>('all');

  // Reset filter to "All Images" when modal closes
  useEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- Reset filter on modal close
      setFilterType('all');
    }
  }, [isOpen]);
  const [pendingImage, setPendingImage] = useState<ImageInfo | null>(null);
  const [showUnstableWarning, setShowUnstableWarning] = useState(false);

  const { data: allImages, loading, error, reload } = useAsyncDataWhen<ImageInfo[]>(
    isOpen && !!board,
    () => getImagesForBoard(board!.slug),
    [isOpen, board?.slug]
  );

  const imagesReady = useMemo(() => {
    return !!(allImages && allImages.length > 0);
  }, [allImages]);

  const { showSkeleton } = useSkeletonLoading(loading, imagesReady);

  useEffect(() => {
    if (!isOpen) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset warning state on close
      setPendingImage(null);
      setShowUnstableWarning(false);
    }
  }, [isOpen]);

  // Warn before selecting nightly builds or community-board images
  function handleImageClick(image: ImageInfo) {
    const isNightly = image.stability === 'nightly';
    const isCommunityBoard = board?.support_tier === 'community';

    if (!isNightly && !isCommunityBoard) {
      onSelect(image);
      return;
    }

    setPendingImage(image);
    setShowUnstableWarning(true);
  }

  function handleUnstableWarningConfirm() {
    if (pendingImage) {
      onSelect(pendingImage);
      setPendingImage(null);
    }
    setShowUnstableWarning(false);
  }

  function handleUnstableWarningCancel() {
    setPendingImage(null);
    setShowUnstableWarning(false);
  }

  const availableFilters = useMemo(() => {
    if (!allImages) return { recommended: false, stable: false, nightly: false, rolling: false, apps: false, barebone: false };
    return {
      recommended: hasImagesForFilter(allImages, 'recommended'),
      stable: hasImagesForFilter(allImages, 'stable'),
      nightly: hasImagesForFilter(allImages, 'nightly'),
      rolling: hasImagesForFilter(allImages, 'rolling'),
      apps: hasImagesForFilter(allImages, 'apps'),
      barebone: hasImagesForFilter(allImages, 'barebone'),
    };
  }, [allImages]);

  const filteredImages = useMemo(() => {
    if (!allImages) return [];
    return applyFilter(allImages, filterType);
  }, [allImages, filterType]);

  const title = t('modal.selectImage');

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="modal-filter-bar">
        <button
          className={`filter-btn ${filterType === 'all' ? 'active' : ''}`}
          onClick={() => setFilterType('all')}
        >
          <Layers size={14} />
          {t('modal.allImages')}
        </button>
        {FILTER_BUTTONS.map(({ key, labelKey, icon: Icon }) =>
          availableFilters[key] && (
            <button
              key={key}
              className={`filter-btn ${filterType === key ? 'active' : ''}`}
              onClick={() => setFilterType(key)}
            >
              <Icon size={14} />
              {t(labelKey)}
            </button>
          )
        )}
      </div>

      {error ? (
        <ErrorDisplay error={error} onRetry={reload} compact />
      ) : (
        <>
          {showSkeleton && <ListItemSkeleton count={UI.SKELETON.IMAGE_MODAL} />}
          {filteredImages.length === 0 && !showSkeleton && (
            <div className="no-results">
              <Package size={48} />
              <p>{t('modal.noImages')}</p>
              <button onClick={() => setFilterType('all')} className="btn btn-secondary">
                {t('modal.allImages')}
              </button>
            </div>
          )}
          <div className="modal-list">
          {!showSkeleton && filteredImages.map((image) => {
            const desktopEnv = getDesktopEnv(image.image_variant);
            const kernelType = getKernelType(image.kernel_branch);
            const osInfo = getOsInfo(image.distro_release);
            const appInfo = getAppInfo(image.preinstalled_application);
            const badgeConfig = kernelType ? KERNEL_BADGES[kernelType] : null;
            const displayInfo = appInfo || osInfo;

            return (
              <button
                key={image.file_url}
                className={`list-item ${image.promoted ? 'promoted' : ''}`}
                onClick={() => handleImageClick(image)}
              >
                <div className="list-item-icon os-icon" style={{ backgroundColor: displayInfo?.color || DEFAULT_COLOR }}>
                  {displayInfo?.logo ? (
                    <img src={displayInfo.logo} alt={displayInfo.name} />
                  ) : (
                    <Package size={32} color="white" />
                  )}
                </div>

                <div className="list-item-content" style={{ flex: 1 }}>
                  <div className="list-item-title">
                    Armbian {image.release} {image.distro_release}
                  </div>

                  <div className="image-info-side-panel">
                    {/* Variant badge (desktop or CLI) - always shown, even with an app overlay */}
                    {desktopEnv && DESKTOP_BADGES[desktopEnv] ? (
                      <div
                        className="side-info-badge"
                        style={{
                          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                          boxShadow: '0 2px 6px rgba(59, 130, 246, 0.4)',
                          border: 'none',
                          color: 'white',
                        }}
                      >
                        <Monitor size={11} />
                        <span>{DESKTOP_BADGES[desktopEnv].label}</span>
                      </div>
                    ) : (
                      <div
                        className="side-info-badge"
                        style={{
                          background: 'linear-gradient(135deg, #64748b 0%, #475569 100%)',
                          boxShadow: '0 2px 6px rgba(100, 116, 139, 0.3)',
                          border: 'none',
                          color: 'white',
                        }}
                      >
                        <Terminal size={11} />
                        <span>CLI</span>
                      </div>
                    )}

                    {badgeConfig && (
                      <div
                        className="side-info-badge badge-kernel"
                        style={{
                          background: `linear-gradient(135deg, ${badgeConfig.color} 0%, ${adjustBrightness(badgeConfig.color, -20)} 100%)`,
                          boxShadow: `0 2px 6px ${badgeConfig.color}66`,
                          border: 'none',
                          color: 'white',
                        }}
                      >
                        <Zap size={11} />
                        <span>{badgeConfig.label}</span>
                        {image.kernel_version && (
                          <span style={{ opacity: 0.9, fontSize: '11px', marginLeft: 2 }}> {image.kernel_version}</span>
                        )}
                      </div>
                    )}

                    {/* Preinstalled app badge - shown in addition to the variant, not instead of it */}
                    {image.preinstalled_application && (
                      <div
                        className="side-info-badge"
                        style={{
                          background: appInfo?.badgeColor || 'var(--accent)',
                          boxShadow: `0 2px 6px ${appInfo?.badgeColor || 'rgba(249, 115, 22, 0.4)'}66`,
                          border: 'none',
                          color: 'white',
                        }}
                      >
                        <AppWindow size={11} />
                        <span>{appInfo?.badge ?? appInfo?.name ?? image.preinstalled_application}</span>
                      </div>
                    )}
                  </div>
                </div>

                <span className="badge badge-size">
                  <Download size={11} />
                  {formatFileSize(image.file_size, t('common.unknown'))}
                </span>
              </button>
            );
          })}
          </div>
        </>
      )}

      {showUnstableWarning && pendingImage && (
        <ConfirmationDialog
          isOpen={showUnstableWarning}
          title={t('modal.imageStatusTitle')}
          message={
            board?.support_tier === 'community'
              ? t('modal.communityBoardMessage')
              : t('modal.nightlyBuildMessage')
          }
          confirmText={t('common.confirm')}
          cancelText={t('common.cancel')}
          isDanger={false}
          onCancel={handleUnstableWarningCancel}
          onConfirm={handleUnstableWarningConfirm}
        />
      )}
    </Modal>
  );
}

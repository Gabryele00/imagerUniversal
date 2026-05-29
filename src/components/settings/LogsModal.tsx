import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { X, Copy, Check } from 'lucide-react';
import Ansi from 'ansi-to-html';
import { getLogs } from '../../hooks/useTauri';
import { TIMING } from '../../config';

// Remove ANSI escape codes from text
function stripAnsiCodes(text: string): string {
  // eslint-disable-next-line no-control-regex -- matching control chars is intentional
  const ansiEscapePattern = /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g;
  return text.replace(ansiEscapePattern, '');
}

interface LogsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Modal for viewing application logs with ANSI color formatting
export function LogsModal({ isOpen, onClose }: LogsModalProps) {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    if (isOpen) {
      loadLogs();
    }
  }, [isOpen]);

  const loadLogs = async () => {
    setLoading(true);
    setError(null);
    try {
      const logContent = await getLogs();
      setLogs(logContent);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load logs');
      console.error('Failed to load logs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyLogs = async () => {
    try {
      if (!logs) return;
      const plainText = stripAnsiCodes(logs);
      await navigator.clipboard.writeText(plainText);
      setCopied(true);
      setTimeout(() => setCopied(false), TIMING.COPIED_NOTIFICATION);
    } catch (err) {
      console.error('Failed to copy logs:', err);
    }
  };

  const ansiConverter = new Ansi({
    fg: '#FFF',
    bg: '#000',
    newline: true,
    escapeXML: true,
    stream: false
  });

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-content logs-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t('settings.viewLogs')}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            <X size={20} />
          </button>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="logs-loading">{t('modal.loading')}</div>
          ) : error ? (
            <div className="logs-error">{error}</div>
          ) : (
            <>
              <pre
                className="logs-content"
                dangerouslySetInnerHTML={{
                  __html: logs ? ansiConverter.toHtml(logs) : t('settings.noLogsAvailable')
                }}
              />
              {logs && (
                <button className="logs-copy-button" onClick={handleCopyLogs}>
                  {copied ? (
                    <>
                      <Check size={16} />
                      <span>{t('settings.copied')}</span>
                    </>
                  ) : (
                    <>
                      <Copy size={16} />
                      <span>{t('settings.copyLogs')}</span>
                    </>
                  )}
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Skeleton placeholders shown while cards and lists load

import { UI } from '../../config';

interface BoardCardSkeletonProps {
  count?: number;
}

export function BoardCardSkeleton({ count = UI.SKELETON.BOARD_GRID_COUNT }: BoardCardSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div key={`skeleton-${index}`} className="board-card-skeleton">
          <div className="board-card-skeleton-image skeleton" />
          <div className="board-card-skeleton-info">
            <div className="board-card-skeleton-name skeleton" />
            <div className="board-card-skeleton-badges">
              <div className="board-card-skeleton-badge skeleton" />
              <div className="board-card-skeleton-badge skeleton" />
            </div>
          </div>
        </div>
      ))}
    </>
  );
}

interface ListItemSkeletonProps {
  count?: number;
}

export function ListItemSkeleton({ count = UI.SKELETON.LIST_COUNT }: ListItemSkeletonProps) {
  return (
    <>
      {Array.from({ length: count }).map((_, index) => (
        <div key={`skeleton-${index}`} className="list-item-skeleton">
          <div className="list-item-skeleton-icon skeleton" />
          <div className="list-item-skeleton-content">
            <div className="list-item-skeleton-title skeleton" />
            <div className="list-item-skeleton-subtitle skeleton" />
          </div>
        </div>
      ))}
    </>
  );
}

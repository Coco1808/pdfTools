import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
  sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { formatBytes, type PdfFileItem } from '../lib/types'
import './SortableFileList.less'

interface Props {
  items: PdfFileItem[]
  onChange: (items: PdfFileItem[]) => void
  disabled?: boolean
}

function Row({
  item,
  index,
  total,
  disabled,
  onRemove,
  onMove,
}: {
  item: PdfFileItem
  index: number
  total: number
  disabled?: boolean
  onRemove: () => void
  onMove: (dir: -1 | 1) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: item.id,
    disabled,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`file-row ${isDragging ? 'dragging' : ''}`}
    >
      <button
        type="button"
        className="drag-handle"
        aria-label="拖拽排序"
        disabled={disabled}
        {...attributes}
        {...listeners}
      >
        <span />
        <span />
        <span />
      </button>
      <div className="file-meta">
        <span className="file-index">{index + 1}</span>
        <div>
          <p className="file-name">{item.name}</p>
          <p className="file-size">{formatBytes(item.size)}</p>
        </div>
      </div>
      <div className="file-actions">
        <button type="button" className="icon-btn" disabled={disabled || index === 0} onClick={() => onMove(-1)} aria-label="上移">
          ↑
        </button>
        <button
          type="button"
          className="icon-btn"
          disabled={disabled || index === total - 1}
          onClick={() => onMove(1)}
          aria-label="下移"
        >
          ↓
        </button>
        <button type="button" className="icon-btn danger" disabled={disabled} onClick={onRemove} aria-label="删除">
          ×
        </button>
      </div>
    </li>
  )
}

export function SortableFileList({ items, onChange, disabled }: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    onChange(arrayMove(items, oldIndex, newIndex))
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
      <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
        <ul className="file-list">
          {items.map((item, index) => (
            <Row
              key={item.id}
              item={item}
              index={index}
              total={items.length}
              disabled={disabled}
              onRemove={() => onChange(items.filter((i) => i.id !== item.id))}
              onMove={(dir) => {
                const next = index + dir
                if (next < 0 || next >= items.length) return
                onChange(arrayMove(items, index, next))
              }}
            />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  )
}

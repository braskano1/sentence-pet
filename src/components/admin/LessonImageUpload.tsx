import { uploadLessonImage, deleteByUrl, type LessonImageSlot } from '../../firebase/storage';
import { ImageUpload } from './ImageUpload';

/** Thin wrapper: binds the generic ImageUpload to the lesson-image storage slots
 *  (lessonImages/{itemId}/{slot}.{ext}). */
export function LessonImageUpload({ label, itemId, slot, value, onUpload, onClear }: {
  label: string;
  itemId: string;
  slot: LessonImageSlot;
  value?: string;
  onUpload: (url: string) => void;
  onClear: () => void;
}) {
  return (
    <ImageUpload
      label={label}
      value={value}
      onUpload={onUpload}
      onClear={onClear}
      upload={(file) => uploadLessonImage(itemId, slot, file)}
      remove={deleteByUrl}
    />
  );
}

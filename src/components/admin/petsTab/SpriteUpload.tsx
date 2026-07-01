import { uploadSprite, deleteSpriteByUrl, type SpriteSlot } from '../../../firebase/storage';
import { ImageUpload } from '../ImageUpload';

/** Thin wrapper: binds the generic ImageUpload to the pet-sprite storage slots. */
export function SpriteUpload({ label, slot, defId, value, onUpload, onClear }: {
  label: string;
  slot: SpriteSlot;
  defId: string;
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
      upload={(file) => uploadSprite(defId, slot, file)}
      remove={deleteSpriteByUrl}
    />
  );
}

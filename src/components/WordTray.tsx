interface Props {
  tiles: string[];
  onPickWord: (word: string) => void;
}

export function WordTray({ tiles, onPickWord }: Props) {
  return (
    <div className="flex flex-wrap gap-3 justify-center">
      {tiles.map((word, i) => (
        <button
          key={`${word}-${i}`}
          onClick={() => onPickWord(word)}
          className="min-h-12 px-5 py-3 rounded-xl bg-indigo-500 text-white text-lg font-semibold shadow active:scale-95"
        >
          {word}
        </button>
      ))}
    </div>
  );
}

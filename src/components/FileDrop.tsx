import { useCallback, useRef, useState } from "react";

interface Props {
  onFile: (text: string, filename: string) => void;
  busy?: boolean;
}

export default function FileDrop({ onFile, busy = false }: Props) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const read = useCallback(
    (file: File) => {
      setError(null);
      const reader = new FileReader();
      reader.onerror = () => setError(`Could not read "${file.name}".`);
      reader.onload = () => onFile(String(reader.result ?? ""), file.name);
      // MetaTrader writes statements in the platform's local charset; UTF-8 covers
      // the overwhelming majority and mis-decoded symbol names are cosmetic.
      reader.readAsText(file, "utf-8");
    },
    [onFile],
  );

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const file = event.dataTransfer.files?.[0];
          if (file) read(file);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-14 text-center transition ${
          dragging
            ? "border-win bg-win/5"
            : "border-edge bg-panel hover:border-slate-600"
        } ${busy ? "pointer-events-none opacity-60" : ""}`}
      >
        <p className="text-base font-medium text-slate-200">
          {busy ? "Reading your trades…" : "Drop your trade history here"}
        </p>
        <p className="mt-2 max-w-md text-sm text-muted">
          MetaTrader 4/5 detailed statement (.htm), TradingView list-of-trades
          export (.csv), or any CSV with a close date and a profit column.
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".htm,.html,.csv,.tsv,.txt"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file) read(file);
            event.target.value = "";
          }}
        />
      </div>
      {error && <p className="mt-3 text-sm text-loss">{error}</p>}
    </div>
  );
}

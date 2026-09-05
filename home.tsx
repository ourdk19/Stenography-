import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  ChevronRight,
  CircleHelp,
  Clipboard,
  Download,
  FileImage,
  Info,
  LockKeyhole,
  MessageSquareText,
  RotateCcw,
  ScanEye,
  ShieldCheck,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { decodeMessage, encodeMessage, getMessageCapacity } from '@/lib/steganography';

type Mode = 'encode' | 'decode';
type Feedback = { type: 'success' | 'error'; message: string } | null;
type ImageAsset = {
  file: File;
  image: HTMLImageElement;
  url: string;
  width: number;
  height: number;
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function loadImage(file: File): Promise<ImageAsset> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => resolve({ file, image, url, width: image.naturalWidth, height: image.naturalHeight });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This image could not be opened. Try another PNG.'));
    };
    image.src = url;
  });
}

function PixelMark() {
  return (
    <span className="grid h-9 w-9 grid-cols-3 grid-rows-3 gap-[3px] rounded-lg bg-[#d6f581] p-[7px]" aria-hidden="true">
      <span className="rounded-[1px] bg-[#163b3b]" />
      <span className="rounded-[1px] bg-[#163b3b]" />
      <span />
      <span className="rounded-[1px] bg-[#163b3b]" />
      <span className="rounded-[1px] bg-[#163b3b]" />
      <span className="rounded-[1px] bg-[#163b3b]" />
      <span />
      <span className="rounded-[1px] bg-[#163b3b]" />
      <span className="rounded-[1px] bg-[#163b3b]" />
    </span>
  );
}

function ImagePreview({ asset, accent }: { asset: ImageAsset; accent: 'lime' | 'orange' }) {
  return (
    <div className="group relative overflow-hidden rounded-xl border border-[#d9dfd4] bg-[#e8ece5]">
      <img
        src={asset.url}
        alt={`Preview of ${asset.file.name}`}
        className="max-h-[235px] min-h-[150px] w-full object-contain [image-rendering:auto]"
        data-testid="img-preview"
      />
      <div className="absolute inset-x-3 bottom-3 flex items-center justify-between rounded-lg border border-white/50 bg-[#163b3b]/90 px-3 py-2 text-[11px] text-[#f6f8f4] backdrop-blur-sm">
        <span className="flex min-w-0 items-center gap-2">
          <FileImage className={`h-3.5 w-3.5 shrink-0 ${accent === 'lime' ? 'text-[#d6f581]' : 'text-[#f1a074]'}`} />
          <span className="truncate font-medium">{asset.file.name}</span>
        </span>
        <span className="ml-2 shrink-0 font-mono-ui text-[10px] text-[#d4dfd5]">{asset.width} × {asset.height}</span>
      </div>
    </div>
  );
}

function DropArea({
  inputId,
  onFile,
  asset,
  accent,
  compact = false,
}: {
  inputId: string;
  onFile: (file: File) => void;
  asset: ImageAsset | null;
  accent: 'lime' | 'orange';
  compact?: boolean;
}) {
  const [dragging, setDragging] = useState(false);
  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file) onFile(file);
  };

  return (
    <label
      htmlFor={inputId}
      onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={handleDrop}
      className={`signal-grid relative block cursor-pointer overflow-hidden rounded-xl border border-dashed transition duration-200 ${
        dragging ? 'border-[#91ad2b] bg-[#eef7ce]' : 'border-[#bbc7b7] bg-[#f8faf6] hover:border-[#91ad2b] hover:bg-[#f2f7e9]'
      } ${compact ? 'p-4' : 'p-5'}`}
      data-testid={`dropzone-${inputId}`}
    >
      <input
        id={inputId}
        type="file"
        accept="image/png,.png"
        className="sr-only"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFile(file);
          event.target.value = '';
        }}
        data-testid={`input-${inputId}`}
      />
      <div className={`flex items-center ${compact ? 'gap-3' : 'flex-col justify-center text-center'}`}>
        <span className={`grid shrink-0 place-items-center rounded-lg ${compact ? 'h-9 w-9' : 'h-12 w-12'} ${accent === 'lime' ? 'bg-[#e3f6af] text-[#597100]' : 'bg-[#f9dfcd] text-[#a5522b]'}`}>
          <Upload className={compact ? 'h-4 w-4' : 'h-5 w-5'} />
        </span>
        <span className={compact ? 'min-w-0' : 'mt-3'}>
          <span className="block text-sm font-semibold text-[#163b3b]">{asset ? 'Replace this PNG' : 'Drop a PNG here'}</span>
          <span className="mt-1 block text-xs leading-relaxed text-[#64766d]">{asset ? 'or click to choose another image' : 'or click to browse your files'}</span>
        </span>
      </div>
    </label>
  );
}

function FeedbackBanner({ feedback, onDismiss }: { feedback: Feedback; onDismiss: () => void }) {
  if (!feedback) return null;
  const success = feedback.type === 'success';
  return (
    <div
      className={`animate-fade flex items-start gap-3 rounded-xl border px-4 py-3 text-sm ${
        success ? 'border-[#bed47c] bg-[#eff8d9] text-[#456000]' : 'border-[#e6b4a5] bg-[#fff0ea] text-[#914126]'
      }`}
      role="status"
      data-testid={`status-${feedback.type}`}
    >
      {success ? <Check className="mt-0.5 h-4 w-4 shrink-0" /> : <Info className="mt-0.5 h-4 w-4 shrink-0" />}
      <span className="flex-1 leading-relaxed">{feedback.message}</span>
      <button type="button" onClick={onDismiss} className="rounded p-0.5 opacity-60 transition hover:bg-black/5 hover:opacity-100" aria-label="Dismiss message" data-testid="button-dismiss-feedback">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export default function Home() {
  const [mode, setMode] = useState<Mode>('encode');
  const [encodeAsset, setEncodeAsset] = useState<ImageAsset | null>(null);
  const [decodeAsset, setDecodeAsset] = useState<ImageAsset | null>(null);
  const [message, setMessage] = useState('');
  const [revealedMessage, setRevealedMessage] = useState('');
  const [encodedUrl, setEncodedUrl] = useState<string | null>(null);
  const [encodedName, setEncodedName] = useState('steganography-message.png');
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [isEncoding, setIsEncoding] = useState(false);
  const [isDecoding, setIsDecoding] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const explainRef = useRef<HTMLElement>(null);

  useEffect(() => () => {
    if (encodeAsset) URL.revokeObjectURL(encodeAsset.url);
  }, [encodeAsset]);

  useEffect(() => () => {
    if (decodeAsset) URL.revokeObjectURL(decodeAsset.url);
  }, [decodeAsset]);

  useEffect(() => () => {
    if (encodedUrl) URL.revokeObjectURL(encodedUrl);
  }, [encodedUrl]);

  const capacity = useMemo(() => (
    encodeAsset ? getMessageCapacity(encodeAsset.width, encodeAsset.height) : 0
  ), [encodeAsset]);
  const messageBytes = useMemo(() => new TextEncoder().encode(message).length, [message]);
  const capacityPercent = capacity ? Math.min(100, Math.round((messageBytes / capacity) * 100)) : 0;
  const canEncode = Boolean(encodeAsset && message.trim() && messageBytes <= capacity && !isEncoding);

  const chooseImage = async (file: File, target: 'encode' | 'decode') => {
    if (file.type !== 'image/png' && !file.name.toLowerCase().endsWith('.png')) {
      setFeedback({ type: 'error', message: 'Please choose a PNG image. JPEG files cannot carry a reliable hidden signal.' });
      return;
    }
    try {
      const asset = await loadImage(file);
      if (target === 'encode') setEncodeAsset(asset);
      else setDecodeAsset(asset);
      setFeedback(null);
      if (target === 'encode') {
        setEncodedUrl(null);
        setMessage('');
      } else {
        setRevealedMessage('');
      }
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'This image could not be opened.' });
    }
  };

  const handleEncode = async () => {
    if (!encodeAsset || !message.trim()) return;
    setIsEncoding(true);
    setFeedback(null);
    try {
      const blob = await encodeMessage(encodeAsset.image, message);
      const url = URL.createObjectURL(blob);
      setEncodedUrl(url);
      setEncodedName(`${encodeAsset.file.name.replace(/\.png$/i, '')}-hidden.png`);
      setFeedback({ type: 'success', message: 'Your message is now tucked into the image. Download the new PNG to share it.' });
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'Encoding could not be completed.' });
    } finally {
      setIsEncoding(false);
    }
  };

  const handleDecode = () => {
    if (!decodeAsset) return;
    setIsDecoding(true);
    setFeedback(null);
    window.setTimeout(() => {
      try {
        const decoded = decodeMessage(decodeAsset.image);
        setRevealedMessage(decoded);
        setFeedback({ type: 'success', message: 'A message was found. It never left your browser during this process.' });
      } catch (error) {
        setRevealedMessage('');
        setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'This image does not contain a readable message.' });
      } finally {
        setIsDecoding(false);
      }
    }, 220);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(revealedMessage);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1800);
    } catch {
      setFeedback({ type: 'error', message: 'Copy is unavailable in this browser. Select the message to copy it manually.' });
    }
  };

  const switchMode = (nextMode: Mode) => {
    setMode(nextMode);
    setFeedback(null);
  };

  return (
    <div className="noise min-h-[100dvh] text-[#163b3b]">
      <header className="mx-auto flex max-w-[1240px] items-center justify-between px-5 py-5 sm:px-8 lg:px-10">
        <div className="flex items-center gap-3">
          <PixelMark />
          <div>
            <div className="font-display text-[19px] font-semibold leading-none tracking-[-0.02em]">Steganography Studio</div>
            <div className="mt-1 font-mono-ui text-[9px] uppercase tracking-[0.18em] text-[#789085]">A quiet signal workbench</div>
          </div>
        </div>
        <div className="hidden items-center gap-2 rounded-full border border-[#d7e2cf] bg-[#f8fbf5] px-3 py-2 text-[11px] font-medium text-[#587060] sm:flex">
          <ShieldCheck className="h-3.5 w-3.5 text-[#789b1f]" />
          Runs locally in your browser
        </div>
        <div className="flex h-8 w-8 items-center justify-center rounded-full border border-[#d7e2cf] bg-[#f8fbf5] text-[#789085] sm:hidden" title="Runs locally in your browser">
          <ShieldCheck className="h-4 w-4" />
        </div>
      </header>

      <main className="mx-auto max-w-[1240px] px-5 pb-16 sm:px-8 lg:px-10">
        <section className="grid items-end gap-8 pb-9 pt-10 lg:grid-cols-[minmax(0,1fr)_310px] lg:pt-16">
          <div className="animate-rise">
            <div className="mb-5 flex items-center gap-2 font-mono-ui text-[10px] font-bold uppercase tracking-[0.22em] text-[#7b951f]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#9bbb29]" />
              Private by design
            </div>
            <h1 className="max-w-[700px] font-display text-[clamp(2.75rem,6vw,5.5rem)] font-semibold leading-[0.96] tracking-[-0.055em] text-[#163b3b]">
              Send a signal in <span className="relative inline-block whitespace-nowrap">plain sight<span className="absolute -bottom-1 left-0 h-2 w-full -rotate-1 rounded-full bg-[#d6f581]/70" /></span>.
            </h1>
            <p className="mt-6 max-w-[560px] text-[15px] leading-7 text-[#5d7066] sm:text-[17px]">
              Hide a note inside the pixels of an ordinary PNG. No account, no upload, no trace beyond the file you choose to save.
            </p>
          </div>
          <div className="animate-rise-delay hidden border-l border-[#d9dfd4] pl-6 lg:block">
            <div className="mb-4 flex items-center gap-2 text-[#789085]">
              <CircleHelp className="h-4 w-4" />
              <span className="font-mono-ui text-[10px] font-bold uppercase tracking-[0.18em]">Good to know</span>
            </div>
            <p className="text-sm leading-6 text-[#64766d]">
              The image still looks the same. Only the least-significant bits of its color channels change — too small for the eye to notice.
            </p>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_310px] lg:items-start">
          <div className="animate-rise rounded-2xl border border-[#d9dfd4] bg-[#fbfdf9] p-4 shadow-[0_18px_50px_-32px_rgba(22,59,59,0.36)] sm:p-6" data-testid="workbench">
            <div className="flex flex-col gap-4 border-b border-[#e3e8df] pb-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-mono-ui text-[10px] font-bold uppercase tracking-[0.18em] text-[#829287]">Workbench / 01</div>
                <h2 className="mt-1 font-display text-2xl font-semibold tracking-[-0.025em]">Choose your move</h2>
              </div>
              <div className="flex rounded-lg bg-[#eef2eb] p-1" role="tablist" aria-label="Steganography mode">
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'encode'}
                  onClick={() => switchMode('encode')}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition sm:flex-none ${mode === 'encode' ? 'bg-[#163b3b] text-[#e7f7b0] shadow-sm' : 'text-[#6f8277] hover:text-[#163b3b]'}`}
                  data-testid="button-mode-encode"
                >
                  <ArrowDownToLine className="h-3.5 w-3.5" />
                  Hide a message
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mode === 'decode'}
                  onClick={() => switchMode('decode')}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-2 text-xs font-semibold transition sm:flex-none ${mode === 'decode' ? 'bg-[#163b3b] text-[#e7f7b0] shadow-sm' : 'text-[#6f8277] hover:text-[#163b3b]'}`}
                  data-testid="button-mode-decode"
                >
                  <ArrowUpFromLine className="h-3.5 w-3.5" />
                  Reveal a message
                </button>
              </div>
            </div>

            <div className="pt-6">
              {mode === 'encode' ? (
                <div className="animate-fade space-y-5">
                  <div className="grid gap-5 md:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <label className="text-sm font-semibold text-[#234744]">1. Pick a cover image</label>
                        <span className="font-mono-ui text-[10px] text-[#94a199]">PNG only</span>
                      </div>
                      {encodeAsset ? <ImagePreview asset={encodeAsset} accent="lime" /> : <DropArea inputId="encode-image" onFile={(file) => void chooseImage(file, 'encode')} asset={encodeAsset} accent="lime" />}
                      {encodeAsset && (
                        <button type="button" onClick={() => setEncodeAsset(null)} className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#77887e] transition hover:text-[#a5522b]" data-testid="button-remove-encode-image">
                          <RotateCcw className="h-3 w-3" /> Choose a different image
                        </button>
                      )}
                    </div>
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <label htmlFor="secret-message" className="text-sm font-semibold text-[#234744]">2. Write your message</label>
                        <MessageSquareText className="h-4 w-4 text-[#a7b1a8]" />
                      </div>
                      <textarea
                        id="secret-message"
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        disabled={!encodeAsset}
                        placeholder={encodeAsset ? 'A few words, a thought, a plan…' : 'Choose an image first'}
                        className="h-[156px] w-full resize-none rounded-xl border border-[#d9dfd4] bg-[#f8faf6] px-4 py-3.5 text-sm leading-6 text-[#234744] outline-none transition placeholder:text-[#a0aaa2] focus:border-[#9bbb29] focus:ring-4 focus:ring-[#d6f581]/30 disabled:cursor-not-allowed disabled:opacity-60"
                        data-testid="input-secret-message"
                      />
                      <div className="mt-2 flex items-center justify-between font-mono-ui text-[10px] text-[#829287]">
                        <span>{messageBytes.toLocaleString()} bytes</span>
                        {encodeAsset ? (
                          <span className={capacityPercent > 85 ? 'text-[#a5522b]' : 'text-[#829287]'}>{capacity.toLocaleString()} bytes available</span>
                        ) : <span>Capacity appears here</span>}
                      </div>
                      {encodeAsset && (
                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-[#e5ebe0]" aria-label={`${capacityPercent}% of image capacity used`}>
                          <div className={`h-full rounded-full transition-all duration-300 ${capacityPercent > 100 ? 'bg-[#c76b43]' : 'bg-[#9bbb29]'}`} style={{ width: `${Math.min(100, capacityPercent)}%` }} />
                        </div>
                      )}
                    </div>
                  </div>

                  <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

                  <div className="flex flex-col gap-3 rounded-xl border border-[#e0e7dc] bg-[#f5f8f1] p-3.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-2.5">
                      <LockKeyhole className="mt-0.5 h-4 w-4 shrink-0 text-[#789b1f]" />
                      <p className="text-xs leading-5 text-[#64766d]">Everything happens on this device. Your original image stays untouched.</p>
                    </div>
                    {encodedUrl ? (
                      <button type="button" onClick={() => { const link = document.createElement('a'); link.href = encodedUrl; link.download = encodedName; link.click(); }} className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#d6f581] px-4 py-2.5 text-xs font-bold text-[#294000] transition hover:bg-[#c6e967] active:scale-[0.98]" data-testid="button-download-png">
                        <Download className="h-3.5 w-3.5" /> Download PNG
                      </button>
                    ) : (
                      <button type="button" onClick={() => void handleEncode()} disabled={!canEncode} className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#163b3b] px-4 py-2.5 text-xs font-bold text-[#e7f7b0] transition hover:bg-[#255150] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40" data-testid="button-encode">
                        {isEncoding ? <><Sparkles className="h-3.5 w-3.5 animate-pulse" /> Encoding pixels…</> : <><LockKeyhole className="h-3.5 w-3.5" /> Hide message</>}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="animate-fade space-y-5">
                  <div className="grid gap-5 md:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <label className="text-sm font-semibold text-[#234744]">1. Choose an encoded PNG</label>
                        <span className="font-mono-ui text-[10px] text-[#94a199]">PNG only</span>
                      </div>
                      {decodeAsset ? <ImagePreview asset={decodeAsset} accent="orange" /> : <DropArea inputId="decode-image" onFile={(file) => void chooseImage(file, 'decode')} asset={decodeAsset} accent="orange" compact />}
                      {decodeAsset && (
                        <button type="button" onClick={() => setDecodeAsset(null)} className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#77887e] transition hover:text-[#a5522b]" data-testid="button-remove-decode-image">
                          <RotateCcw className="h-3 w-3" /> Choose a different image
                        </button>
                      )}
                    </div>
                    <div>
                      <div className="mb-3 flex items-center justify-between">
                        <label className="text-sm font-semibold text-[#234744]">2. Read the hidden signal</label>
                        <ScanEye className="h-4 w-4 text-[#a7b1a8]" />
                      </div>
                      <div className={`flex min-h-[156px] flex-col items-center justify-center rounded-xl border border-dashed px-5 text-center ${revealedMessage ? 'border-[#bed47c] bg-[#f2f8e3]' : 'border-[#d9dfd4] bg-[#f8faf6]'}`}>
                        {revealedMessage ? (
                          <div className="w-full text-left">
                            <div className="mb-2 flex items-center gap-2 font-mono-ui text-[10px] font-bold uppercase tracking-[0.14em] text-[#6d891a]"><Check className="h-3.5 w-3.5" /> Message revealed</div>
                            <p className="max-h-[95px] overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-[#234744]" data-testid="text-revealed-message">{revealedMessage}</p>
                          </div>
                        ) : (
                          <>
                            <ScanEye className="mb-2 h-6 w-6 text-[#a6b3a9]" />
                            <p className="text-sm font-semibold text-[#62756a]">{decodeAsset ? 'Ready to inspect' : 'Your message will appear here'}</p>
                            <p className="mt-1 text-xs text-[#98a49b]">The original image is never modified.</p>
                          </>
                        )}
                      </div>
                      {revealedMessage && (
                        <button type="button" onClick={() => void handleCopy()} className="mt-2 flex items-center gap-1.5 text-xs font-medium text-[#6d891a] transition hover:text-[#456000]" data-testid="button-copy-message">
                          {isCopied ? <Check className="h-3 w-3" /> : <Clipboard className="h-3 w-3" />} {isCopied ? 'Copied to clipboard' : 'Copy message'}
                        </button>
                      )}
                    </div>
                  </div>

                  <FeedbackBanner feedback={feedback} onDismiss={() => setFeedback(null)} />

                  <div className="flex flex-col gap-3 rounded-xl border border-[#e0e7dc] bg-[#f5f8f1] p-3.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-start gap-2.5">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[#789b1f]" />
                      <p className="text-xs leading-5 text-[#64766d]">No network requests. Decoding is performed locally, byte by byte.</p>
                    </div>
                    <button type="button" onClick={handleDecode} disabled={!decodeAsset || isDecoding} className="flex shrink-0 items-center justify-center gap-2 rounded-lg bg-[#163b3b] px-4 py-2.5 text-xs font-bold text-[#e7f7b0] transition hover:bg-[#255150] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40" data-testid="button-decode">
                      {isDecoding ? <><Sparkles className="h-3.5 w-3.5 animate-pulse" /> Reading pixels…</> : <><ScanEye className="h-3.5 w-3.5" /> Reveal message</>}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          <aside className="animate-rise-delay space-y-4">
            <div className="rounded-2xl bg-[#163b3b] p-5 text-[#f3f7eb] shadow-[0_18px_48px_-28px_rgba(22,59,59,0.55)]">
              <div className="mb-7 flex items-center justify-between">
                <span className="font-mono-ui text-[10px] font-bold uppercase tracking-[0.2em] text-[#cde978]">The small idea</span>
                <span className="pixel-dots h-8 w-8 rounded-md opacity-80" />
              </div>
              <h2 className="font-display text-[27px] font-semibold leading-[1.05] tracking-[-0.03em]">A message can hide in the last bit.</h2>
              <p className="mt-4 text-sm leading-6 text-[#b5c7b8]">Each pixel carries tiny color values. We change only the last binary digit — a 0 to a 1, or a 1 to a 0.</p>
              <button type="button" onClick={() => explainRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })} className="mt-6 flex items-center gap-1 text-xs font-bold text-[#d6f581] transition hover:gap-2" data-testid="button-how-it-works">
                See how it works <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="rounded-2xl border border-[#d9dfd4] bg-[#f8faf6] p-5">
              <div className="mb-5 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[#8ca71e]" />
                <h2 className="font-display text-lg font-semibold tracking-[-0.02em]">A simple rhythm</h2>
              </div>
              <div className="space-y-4">
                {[
                  ['01', 'Pick a PNG', 'The image is your cover.'],
                  ['02', 'Write or reveal', 'A message becomes pixels.'],
                  ['03', 'Save or share', 'The file looks ordinary.'],
                ].map(([number, title, detail]) => (
                  <div key={number} className="flex gap-3">
                    <span className="font-mono-ui pt-0.5 text-[10px] font-bold text-[#9bad9e]">{number}</span>
                    <div><div className="text-xs font-bold text-[#355550]">{title}</div><div className="mt-0.5 text-xs leading-5 text-[#839188]">{detail}</div></div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </section>

        <section ref={explainRef} className="mt-16 scroll-mt-8 border-t border-[#d9dfd4] pt-10 sm:mt-24 sm:pt-14">
          <div className="grid gap-8 lg:grid-cols-[0.82fr_1.18fr] lg:gap-16">
            <div>
              <div className="mb-3 font-mono-ui text-[10px] font-bold uppercase tracking-[0.2em] text-[#829287]">Under the surface / 02</div>
              <h2 className="font-display text-3xl font-semibold leading-tight tracking-[-0.04em] sm:text-4xl">Pixels have more room than they let on.</h2>
            </div>
            <div className="grid gap-6 sm:grid-cols-3">
              {[
                { icon: FileImage, title: 'PNG stays intact', copy: 'Lossless PNG pixels give the signal a stable place to live.' },
                { icon: LockKeyhole, title: 'Bits do the work', copy: 'A short header marks the message, followed by its UTF-8 bytes.' },
                { icon: ShieldCheck, title: 'Local by default', copy: 'Nothing is sent anywhere. Your browser does the reading and writing.' },
              ].map(({ icon: Icon, title, copy }) => (
                <div key={title} className="border-l-2 border-[#d6f581] pl-4">
                  <Icon className="mb-3 h-4 w-4 text-[#789b1f]" />
                  <h3 className="text-sm font-bold text-[#355550]">{title}</h3>
                  <p className="mt-2 text-xs leading-5 text-[#7a8a80]">{copy}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-12 flex flex-col gap-3 border-y border-[#d9dfd4] py-4 text-xs text-[#829287] sm:flex-row sm:items-center sm:justify-between">
            <span className="font-mono-ui text-[10px] uppercase tracking-[0.16em]">No accounts · no uploads · no external services</span>
            <span className="flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-[#9bbb29]" /> Built for curious minds</span>
          </div>
        </section>
      </main>
    </div>
  );
}
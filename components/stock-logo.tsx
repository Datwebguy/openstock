import { siApple, siCircle, siCoinbase, siGoogle, siMeta, siNvidia, siTesla } from "simple-icons/icons";

type StockLogoProps = { symbol: string; size?: number; logo?: string };

const simpleIcons = {
  AAPLx: siApple,
  GOOGLx: siGoogle,
  NVDAx: siNvidia,
  TSLAx: siTesla,
  METAx: siMeta,
  COINx: siCoinbase,
  CRCLx: siCircle,
};

const brandColors: Record<string, string> = {
  AAPLx: "#111111",
  AMZNx: "#ff9900",
  GOOGLx: "#4285f4",
  NVDAx: "#76b900",
  TSLAx: "#e82127",
  METAx: "#0866ff",
  MSFTx: "#00a4ef",
  COINx: "#0052ff",
  CRCLx: "#635bff",
  SPYx: "#7140c8",
};

function AmazonMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M2.4 16.2c2.9 2.15 7.05 3.45 11.35 3.45 2.7 0 5.85-.75 8.35-2.2.38-.22.1-.66-.32-.46-2.4 1.28-5.5 2.05-8.03 2.05-3.75 0-7.45-1.2-10.3-3.25-.28-.2-.52.16-.05.41z" />
    <path d="M20.7 15.35c-.2-.24-.55-.1-.72.1l-.1.95c0 .7.16 1.45.5 2 .1.16.02.22.2.12 1.4-.4 2.45-1.05 3.35-1.85.14-.12.04-.26-.1-.24-.85.55-1.9 1.15-3.15 1.45.02-.55-.02-1.35-.08-2.53z" />
  </svg>;
}

function MicrosoftMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M3 3h8.2v8.2H3z" />
    <path d="M12.8 3H21v8.2h-8.2z" />
    <path d="M3 12.8h8.2V21H3z" />
    <path d="M12.8 12.8H21V21h-8.2z" />
  </svg>;
}

function SpyMark() {
  return <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M4 6.5h16v1.6H4zm0 4.7h11.5v1.6H4zM4 16h16v1.6H4z" />
  </svg>;
}

export function StockLogo({ symbol, size = 42, logo }: StockLogoProps) {
  const simple = simpleIcons[symbol as keyof typeof simpleIcons];
  const color = brandColors[symbol] ?? "#111827";
  const localMark = symbol === "AMZNx" ? <AmazonMark /> : symbol === "MSFTx" ? <MicrosoftMark /> : symbol === "SPYx" ? <SpyMark /> : null;
  return <span className="stock-logo" style={{ width: size, height: size, color }} role="img" aria-label={`${symbol} logo`}>
    {simple ? <svg viewBox="0 0 24 24" aria-hidden="true" dangerouslySetInnerHTML={{ __html: `<path d="${simple.path}"/>` }} /> : localMark ? localMark : logo ? <img className="stock-logo__remote" src={logo} alt="" width={size} height={size} /> : null}
  </span>;
}

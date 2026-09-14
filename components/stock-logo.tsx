import { siApple, siCircle, siCoinbase, siGoogle, siMeta, siNvidia, siTesla } from "simple-icons/icons";

type StockLogoProps = { symbol: string; size?: number; logo?: string };
const icons = { AAPLx: siApple, GOOGLx: siGoogle, NVDAx: siNvidia, TSLAx: siTesla, METAx: siMeta, COINx: siCoinbase, CRCLx: siCircle };
const officialMarks: Record<string, string> = {
  AMZNx: "https://xstocks-metadata.backed.fi/logos/tokens/AMZNx.png",
  MSFTx: "https://xstocks-metadata.backed.fi/logos/tokens/MSFTx.png",
  SPYx: "https://xstocks-metadata.backed.fi/logos/tokens/SPYx.png",
};
const brandColors: Record<string, string> = { AAPLx: "#111111", GOOGLx: "#4285f4", NVDAx: "#76b900", TSLAx: "#e82127", METAx: "#0866ff", COINx: "#0052ff", CRCLx: "#635bff" };

export function StockLogo({ symbol, size = 42, logo }: StockLogoProps) {
  const icon = icons[symbol as keyof typeof icons];
  const source = logo ?? officialMarks[symbol];
  const color = brandColors[symbol] ?? "#111827";
  return <span className={`stock-logo ${symbol === "SPYx" ? "stock-logo--spdr" : ""}`} style={{ width: size, height: size, color }} role="img" aria-label={`${symbol} logo`}>
    {icon ? <svg viewBox="0 0 24 24" role="img" aria-hidden="true" dangerouslySetInnerHTML={{ __html: `<path d="${icon.path}"/>` }} /> : source ? <img src={source} alt={`${symbol} logo`} width={size} height={size} /> : null}
  </span>;
}

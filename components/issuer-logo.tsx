import { StockLogo } from "@/components/stock-logo";

type IssuerLogoProps = {
  symbol: string;
  src?: string;
  size?: number;
};

export function IssuerLogo({ symbol, src, size = 42 }: IssuerLogoProps) {
  if (!src) return <StockLogo symbol={symbol} size={size} />;

  return (
    <span className="stock-logo stock-logo--remote" style={{ width: size, height: size }} aria-label={`${symbol} issuer logo`}>
      <img src={src} alt="" width={size} height={size} />
    </span>
  );
}

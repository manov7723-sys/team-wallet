export const getTokenImage = (symbol: string): string => {
  switch (symbol.toUpperCase()) {
    case "SOL":
      return "https://cryptologos.cc/logos/solana-sol-logo.png";
    case "USDC":
      return "https://cryptologos.cc/logos/usd-coin-usdc-logo.png";
    case "USDT":
      return "https://cryptologos.cc/logos/tether-usdt-logo.png";
    case "BONK":
      return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263/logo.png";
    case "JUP":
      return "https://raw.githubusercontent.com/trustwallet/assets/master/blockchains/solana/assets/JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN/logo.png";
    default:
      return "https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/solana/info/logo.png";
  }
};

export const TOKEN_LOGOS: Record<string, string> = {
  USDC: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png",
  USDT: "https://cryptologos.cc/logos/tether-usdt-logo.png",
  EURC: "https://s2.coinmarketcap.com/static/img/coins/200x200/20641.png",
  BONK: "https://cryptologos.cc/logos/bonk-bonk-logo.png",
  SOL: "https://cryptologos.cc/logos/solana-sol-logo.png",
};
export const DEVNET_MINT_TO_SYMBOL: Record<string, keyof typeof TOKEN_LOGOS> = {
  "4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU": "USDC",
  HzwqbKZw8HxMN6bF2yFZNrht3c2iXXzpKcFu7uBEDKtr: "EURC",
};

export const getTokenLogo = (assetType: "SOL" | "SPL" | "NFT", mint?: string) => {
  if (assetType === "SOL") return TOKEN_LOGOS.SOL;

  if (assetType === "SPL") {
    const cleanMint = mint?.trim();
    const symbol = DEVNET_MINT_TO_SYMBOL[cleanMint ?? ""];
    return (
      (symbol && TOKEN_LOGOS[symbol]) ||
      "https://cdn.jsdelivr.net/gh/trustwallet/assets@master/blockchains/solana/info/logo.png"
    );
  }

  return "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRWxMMGujyFG5e8007IpGyUo6nyAMmfGJayDQ&s";
};

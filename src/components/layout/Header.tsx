import { assetUrl, brand } from '@/brand/brand.config';
import { ConnectButton, WalletModal } from '@/wallet';

export function Header() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-3 sm:h-16 sm:flex-nowrap sm:py-0 sm:px-6">
        <a href={import.meta.env.BASE_URL} className="flex shrink-0 items-center">
          <img src={assetUrl(brand.logo.onLight)} alt={brand.logo.alt} className="h-6 w-auto" />
        </a>
        <h1 className="order-last basis-full whitespace-nowrap font-display text-xl leading-none sm:order-none sm:mr-auto sm:basis-auto sm:text-2xl">
          Pick your <span className="font-accent">card</span>
        </h1>
        <ConnectButton />
      </div>
      <WalletModal />
    </header>
  );
}

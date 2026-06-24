import { cn } from './table/utils';
import { BRAND_NAME, BRAND_SUBTITLE, DITMON_ICON, DITMON_LOGO_ALT, DITMON_LOGO_PRIMARY } from '../branding/ditmonBranding';

type BrandLogoVariant = 'full' | 'compact' | 'icon';

interface BrandLogoProps {
  variant: BrandLogoVariant;
  className?: string;
}

const variantSrc: Record<BrandLogoVariant, string> = {
  full: DITMON_LOGO_PRIMARY,
  compact: DITMON_LOGO_ALT,
  icon: DITMON_ICON,
};

export const BrandLogo = ({ variant, className }: BrandLogoProps) => {
  const isIcon = variant === 'icon';
  const containerClass =
    variant === 'full'
      ? 'w-[160px] md:w-[180px] h-auto'
      : variant === 'compact'
        ? 'w-[84px] md:w-[92px] h-auto'
        : 'h-18 w-18 md:h-20 md:w-20 rounded-2xl';

  return (
    <div className={cn('inline-flex items-center justify-center overflow-hidden', containerClass, className)}>
      <img
        src={variantSrc[variant]}
        alt={`${BRAND_NAME} ${BRAND_SUBTITLE}`}
        className={cn('block object-contain drop-shadow-[0_1px_1px_rgba(15,23,42,0.08)]', isIcon ? 'h-full w-full rounded-2xl' : 'h-auto w-full')}
        loading="eager"
        decoding="async"
      />
    </div>
  );
};

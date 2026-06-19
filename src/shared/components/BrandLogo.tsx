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
  const containerClass = variant === 'full' ? 'h-14 w-auto' : variant === 'compact' ? 'h-10 w-auto' : 'h-10 w-10 rounded-xl';

  return (
    <div className={cn('inline-flex items-center justify-center overflow-hidden', containerClass, className)}>
      <img
        src={variantSrc[variant]}
        alt={`${BRAND_NAME} ${BRAND_SUBTITLE}`}
        className={cn('block object-contain', isIcon ? 'h-full w-full rounded-xl' : 'h-full w-auto')}
        loading="eager"
        decoding="async"
      />
    </div>
  );
};

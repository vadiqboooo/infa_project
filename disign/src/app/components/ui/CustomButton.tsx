import { ButtonHTMLAttributes, forwardRef } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'telegram';
  size?: 'sm' | 'md' | 'lg';
}

export const CustomButton = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={twMerge(
          clsx(
            'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-600 disabled:pointer-events-none disabled:opacity-50',
            {
              'bg-[#3F8C62] text-white hover:bg-[#32704e]': variant === 'primary',
              'bg-white text-gray-900 border border-gray-200 hover:bg-gray-50': variant === 'secondary',
              'bg-transparent border border-gray-200 hover:bg-gray-50': variant === 'outline',
              'hover:bg-gray-100': variant === 'ghost',
              'bg-[#2AABEE] text-white hover:bg-[#229ED9]': variant === 'telegram',
              'h-9 px-4 text-sm': size === 'sm',
              'h-11 px-8 text-base': size === 'md',
              'h-14 px-8 text-lg': size === 'lg',
            },
            className
          )
        )}
        {...props}
      />
    );
  }
);

CustomButton.displayName = 'CustomButton';

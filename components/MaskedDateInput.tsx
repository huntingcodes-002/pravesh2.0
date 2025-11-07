'use client';

import React from 'react';
import { IMaskInput } from 'react-imask';
import IMask from 'imask';
import { cn } from '@/lib/utils';

interface MaskedDateInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  onAccept?: (value: string) => void;
  minDate?: Date;
  maxDate?: Date;
}

export const MaskedDateInput = React.forwardRef<HTMLInputElement, MaskedDateInputProps>(
  (
    {
      value,
      onChange,
      placeholder = 'DD/MM/YYYY',
      disabled = false,
      className = '',
      id,
      onAccept,
      minDate = new Date(1920, 0, 1), // Default min: January 1, 1920
      maxDate = new Date(), // Default max: today
    },
    ref
  ) => {
    const currentYear = new Date().getFullYear();

    return (
      <IMaskInput
        mask={Date as any}
        pattern="d/m/Y"
        blocks={{
          d: {
            mask: IMask.MaskedRange,
            from: 1,
            to: 31,
            maxLength: 2,
            autofix: 'pad',
            placeholderChar: 'D',
          },
          m: {
            mask: IMask.MaskedRange,
            from: 1,
            to: 12,
            maxLength: 2,
            autofix: 'pad',
            placeholderChar: 'M',
          },
          Y: {
            mask: IMask.MaskedRange,
            from: 1920,
            to: currentYear,
            maxLength: 4,
            placeholderChar: 'Y',
          },
        }}
        format={(date: Date) => {
          if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
            return '';
          }
          const day = date.getDate().toString().padStart(2, '0');
          const month = (date.getMonth() + 1).toString().padStart(2, '0');
          const year = date.getFullYear().toString();
          return `${day}/${month}/${year}`;
        }}
        parse={(str: string) => {
          if (!str || str.length < 10) {
            return new Date(NaN);
          }
          const parts = str.split('/');
          if (parts.length !== 3) {
            return new Date(NaN);
          }
          const [day, month, year] = parts;
          return new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
        }}
        min={minDate}
        max={maxDate}
        autofix={true}
        lazy={true}
        overwrite={false}
        value={value}
        unmask={false}
        onAccept={(value, maskRef) => {
          const stringValue = String(value);
          if (onAccept) {
            onAccept(stringValue);
          }
          onChange(stringValue);
        }}
        placeholder={placeholder}
        disabled={disabled}
        id={id}
        inputRef={ref}
        className={cn(
          'flex h-12 w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm ring-offset-white',
          'file:border-0 file:bg-transparent file:text-sm file:font-medium',
          'placeholder:text-muted-foreground',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0072CE] focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:bg-gray-50 disabled:opacity-60',
          className
        )}
      />
    );
  }
);

MaskedDateInput.displayName = 'MaskedDateInput';

export default MaskedDateInput;


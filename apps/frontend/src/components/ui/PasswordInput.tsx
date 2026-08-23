'use client';

import { forwardRef, useState } from 'react';
import { Box, IconButton, Input, type InputProps } from '@chakra-ui/react';

interface PasswordInputProps extends Omit<InputProps, 'type'> {
  /** Accessible label for the reveal button, e.g. "Şifreyi göster". */
  toggleLabel?: string;
}

/**
 * Inline SVG rather than an icon package — two glyphs do not justify a
 * dependency. Drawn with `currentColor` so they follow the button's colour.
 */
const iconProps = {
  width: '18',
  height: '18',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: '2',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

function EyeIcon() {
  return (
    <svg {...iconProps}>
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg {...iconProps}>
      <path d="M10.6 6.1A9.9 9.9 0 0 1 12 6c6.4 0 10 6 10 6a17.7 17.7 0 0 1-2.4 3.2M6.6 6.6A17.6 17.6 0 0 0 2 12s3.6 7 10 7a9.7 9.7 0 0 0 5.4-1.6" />
      <path d="M14.1 14.1a3 3 0 1 1-4.2-4.2" />
      <path d="m3 3 18 18" />
    </svg>
  );
}

/**
 * Password field with a reveal toggle. Forwards its ref so react-hook-form's
 * `register()` can be spread onto it directly.
 */
export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ toggleLabel = 'Show password', ...props }, ref) {
    const [visible, setVisible] = useState(false);

    return (
      <Box position="relative" w="full">
        <Input
          ref={ref}
          type={visible ? 'text' : 'password'}
          pr="44px"
          // A revealed password must not end up in the browser's spellcheck or
          // autocorrect dictionaries.
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          {...props}
        />
        <IconButton
          // Inside a <form> a button defaults to type="submit" — without this,
          // revealing the password would submit the form.
          type="button"
          aria-label={toggleLabel}
          aria-pressed={visible}
          onClick={() => setVisible((v) => !v)}
          // Keeps the toggle out of the tab path from password to submit.
          tabIndex={-1}
          variant="ghost"
          size="sm"
          position="absolute"
          right="4px"
          top="50%"
          transform="translateY(-50%)"
          minW="36px"
          h="36px"
          color="text.muted"
          style={{ WebkitTapHighlightColor: 'transparent' }}
        >
          {visible ? <EyeOffIcon /> : <EyeIcon />}
        </IconButton>
      </Box>
    );
  },
);

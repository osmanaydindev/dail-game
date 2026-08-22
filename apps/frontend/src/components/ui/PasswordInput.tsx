'use client';

import { forwardRef, useState } from 'react';
import { Box, IconButton, Input, type InputProps } from '@chakra-ui/react';

interface PasswordInputProps extends Omit<InputProps, 'type'> {
  /** Accessible label for the reveal button, e.g. "Şifreyi göster". */
  toggleLabel?: string;
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
          {visible ? '🙈' : '👁'}
        </IconButton>
      </Box>
    );
  },
);

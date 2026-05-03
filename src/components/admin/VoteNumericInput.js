'use client';

import { useLayoutEffect, useRef } from 'react';

const getRestingValue = (value) => ((value === 0 || value === '0') ? '' : (value ?? ''));
const ARROW_KEYS = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']);

const moveWithinVoteInputScope = (currentInput, direction) => {
    const scope = currentInput.closest('[data-vote-input-scope]');
    if (!scope) return false;

    const inputs = Array.from(scope.querySelectorAll('[data-vote-numeric-input="true"]'))
        .filter((input) => !input.disabled && input.offsetParent !== null);
    const currentIndex = inputs.indexOf(currentInput);
    if (currentIndex === -1) return false;

    const nextIndex = Math.min(
        inputs.length - 1,
        Math.max(0, currentIndex + direction)
    );

    if (nextIndex === currentIndex) return true;

    const nextInput = inputs[nextIndex];
    nextInput.focus();
    nextInput.select?.();
    return true;
};

export default function VoteNumericInput({
    value,
    onChange,
    className,
    disabled,
    placeholder,
    innerRef
}) {
    const inputRef = useRef(null);
    const isFocusedRef = useRef(false);

    const bindInputRef = (element) => {
        inputRef.current = element;
        if (innerRef && typeof innerRef === 'object') {
            innerRef.current = element;
        }
    };

    useLayoutEffect(() => {
        if (!inputRef.current || isFocusedRef.current) return;
        inputRef.current.value = getRestingValue(value);
    }, [value]);

    return (
        <input
            ref={bindInputRef}
            type="text"
            inputMode="numeric"
            defaultValue={getRestingValue(value)}
            placeholder={placeholder || "0"}
            onFocus={(event) => {
                isFocusedRef.current = true;
                event.currentTarget.value = getRestingValue(value);
                event.currentTarget.select();
            }}
            onBlur={(event) => {
                isFocusedRef.current = false;
                event.currentTarget.value = getRestingValue(value);
            }}
            onInput={(event) => {
                const nextValue = event.currentTarget.value.replace(/[^0-9]/g, '');
                if (event.currentTarget.value !== nextValue) {
                    event.currentTarget.value = nextValue;
                }
                onChange(nextValue);
            }}
            onKeyDown={(event) => {
                if (!ARROW_KEYS.has(event.key)) return;

                event.stopPropagation();

                if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
                    event.preventDefault();
                    moveWithinVoteInputScope(event.currentTarget, event.key === 'ArrowDown' ? 1 : -1);
                }
            }}
            data-vote-numeric-input="true"
            disabled={disabled}
            className={className}
        />
    );
}

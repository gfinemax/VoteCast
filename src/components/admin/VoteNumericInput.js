'use client';

import { useLayoutEffect, useRef } from 'react';

const getRestingValue = (value) => ((value === 0 || value === '0') ? '' : (value ?? ''));

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
            disabled={disabled}
            className={className}
        />
    );
}

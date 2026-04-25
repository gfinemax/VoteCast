'use client';

export default function VoteNumericInput({
    value,
    onChange,
    className,
    disabled,
    placeholder,
    innerRef
}) {
    return (
        <input
            ref={innerRef}
            type="text"
            inputMode="numeric"
            value={((value === 0 || value === '0') ? '' : value)}
            placeholder={placeholder || "0"}
            onFocus={(event) => {
                event.target.select();
            }}
            onChange={(event) => {
                onChange(event.target.value.replace(/[^0-9]/g, ''));
            }}
            disabled={disabled}
            className={className}
        />
    );
}

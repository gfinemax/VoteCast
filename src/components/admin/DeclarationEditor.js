'use client';

export default function DeclarationEditor({
    isEditing,
    isConfirmed,
    declaration,
    localDeclaration,
    onChange,
    onStartEdit,
    onFinishEdit
}) {
    const displayValue = isEditing ? localDeclaration : (declaration || '');

    return (
        <section>
            <div className="flex justify-between items-center mb-1 mt-1">
                <h3 className="text-base font-bold text-slate-600 uppercase tracking-wider">
                    03. 선포 문구
                </h3>
                {isEditing && !isConfirmed ? (
                    <button
                        onClick={onFinishEdit}
                        className="text-xs flex items-center gap-1 px-3 py-1 bg-emerald-500 text-white rounded-full hover:bg-emerald-600 transition-colors font-medium"
                    >
                        ✓ 완료
                    </button>
                ) : (
                    <button
                        onClick={onStartEdit}
                        disabled={isConfirmed}
                        className={`text-xs flex items-center gap-1 px-3 py-1 rounded-full transition-colors font-medium ${isConfirmed ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    >
                        ✎ 편집
                    </button>
                )}
            </div>

            <div className="flex flex-col flex-1">
                <textarea
                    value={displayValue}
                    onChange={(event) => onChange(event.target.value)}
                    disabled={!isEditing || isConfirmed}
                    placeholder={isEditing ? "선포문구를 입력하세요..." : "편집 버튼을 클릭하면 자동 생성됩니다."}
                    rows={Math.max(9, (displayValue || '').split('\n').length)}
                    className={`w-full p-4 border rounded-2xl outline-none text-base font-serif resize-none min-h-[180px] flex-1 shadow-sm leading-relaxed transition-colors ${isEditing && !isConfirmed
                        ? 'border-blue-300 bg-white text-slate-700 focus:ring-2 focus:ring-blue-500 shadow-blue-100/50'
                        : 'border-slate-200 bg-slate-50 text-slate-600 cursor-not-allowed'
                        }`}
                />
                {isConfirmed && (
                    <div className="mt-1 text-[10px] text-slate-400 text-right pr-2">
                        * 이 선포문은 의결 확정 시점에 고정되었습니다.
                    </div>
                )}
            </div>
        </section>
    );
}

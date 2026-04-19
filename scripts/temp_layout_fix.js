const fs = require('fs');

const FILE_PATH = './src/components/admin/VoteControl.js';
let content = fs.readFileSync(FILE_PATH, 'utf8');

// Step 1: Change grid container from items-start to items-stretch
content = content.replace(
    '<div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">',
    '{/* Top Grid: Sections 1 and 2 */}\n            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch mb-4">'
);

// Step 2: Make Section 1 and Section 2 stretch via flex-col
content = content.replace(
    '<div className="lg:col-span-4 flex flex-col gap-4">',
    '<div className="lg:col-span-4 flex flex-col items-stretch">'
);
content = content.replace(
    '<div className="lg:col-span-8 flex flex-col gap-4">',
    '<div className="lg:col-span-8 flex flex-col items-stretch">'
);

content = content.replace(
    '<section className={isConfirmed ? "opacity-90 grayscale-[0.3]" : ""}>',
    '<section className={`flex flex-col flex-1 ${isConfirmed ? "opacity-90 grayscale-[0.3]" : ""}`}>'
);
content = content.replace(
    '<section className={isConfirmed ? "pointer-events-none opacity-90" : ""}>',
    '<section className={`flex flex-col flex-1 ${isConfirmed ? "pointer-events-none opacity-90" : ""}`}>'
);

// Step 3: Make inner boxes stretch
content = content.replace(
    '<div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-xl mb-4 relative overflow-hidden ring-1 ring-white/5 group flex flex-col gap-3">',
    '<div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-xl relative overflow-hidden ring-1 ring-white/5 group flex flex-col gap-3 flex-1">'
);

content = content.replace(
    /className=\{(?:\`|"|)(?:transition-all(?: flex-1)?)\s*\$\{hasSplitVoteColumns/,
    'className={`transition-all flex flex-col flex-1 ${hasSplitVoteColumns'
);

content = content.replace(
    /<div\s+className="vote-panel-shell"/,
    '<div\nclassName="vote-panel-shell flex flex-col flex-1"'
);

// Look for Section 3 string
const sect3Match = content.match(/\{\/\* Section 3: Declaration \(Moved to Left Column\) \*\/\}[\s\S]*?<\/section>/);
if (sect3Match) {
    const sect3Str = sect3Match[0];
    content = content.replace(sect3Str, ''); 
    content = content.replace(/\s*<\/div>\s*\{\/\* End of Left Column \*\/\}/, '\n                </div> {/* End of Left Column top grid */}'); 
    
    // Find Section 4 string
    const sect4Match = content.match(/\{\/\* Section 4: Final Confirmation \*\/\}[\s\S]*?<\/section>/);
    if(sect4Match) {
        const sect4Str = sect4Match[0];
        // Remove section 4 from its current place
        content = content.replace(sect4Str, '');
        
        const newBottomGrid = `
                </div> {/* End of Right Column top grid */}
            </div> {/* End of Top Grid */}

            {/* Bottom Grid: Sections 3 and 4 */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
                <div className="lg:col-span-4 flex flex-col gap-4">
                    ${sect3Str}
                </div>
                <div className="lg:col-span-8 flex flex-col gap-4">
                    ${sect4Str}
                </div>
            `;
            
        content = content.replace(
            /(<\/section>\s*)<\/div>\s*\{\/\* End of Right Column \*\/\}\s*<\/div>/,
            '$1' + newBottomGrid + '\n        </div>'
        );
    }
}

fs.writeFileSync(FILE_PATH, content, 'utf8');
console.log("Rewrite successful.");

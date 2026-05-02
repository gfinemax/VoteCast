const fs = require('fs');
const file = 'c:/workspace/antigravity/VoteCast/src/components/admin/DashboardLayout.js';
let content = fs.readFileSync(file, 'utf8');

const target = `                    <div className="p-6 border-b border-slate-100 shrink-0">
                        <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
                                <FileText size={18} />
                            </div>
                            {title}
                        </h1>
                        {titleBadge && (
                            <div className="mt-3">
                                {titleBadge}
                            </div>
                        )}
                        <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
                    </div>`;

// Replace ignoring line ending differences
const normalizedTarget = target.replace(/\r\n/g, '\n');
content = content.replace(/\r\n/g, '\n');

const replacement = `                    <div className="p-6 border-b border-slate-100 shrink-0">
                        <div className="flex items-start justify-between">
                            <div>
                                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                                    <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white">
                                        <FileText size={18} />
                                    </div>
                                    {title}
                                </h1>
                                <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
                            </div>
                            {titleBadge && (
                                <div className="mt-1">
                                    {titleBadge}
                                </div>
                            )}
                        </div>
                    </div>`;

content = content.replace(normalizedTarget, replacement);
fs.writeFileSync(file, content);
console.log('Replaced successfully');

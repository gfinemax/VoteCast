const fs = require('fs');
const path = require('path');

const filePath = path.join('c:', 'workspace', 'antigravity', 'VoteCast', 'src', 'app', 'admin', 'tally', 'page.js');
let content = fs.readFileSync(filePath, 'utf8');

const target1 = `    const [sourceType, setSourceType] = useState(voteData?.tallyConfirmation?.sourceType || 'auto');
    const [manualResults, setManualResults] = useState(voteData?.tallyConfirmation?.manualResults || {});
    const [overrideReason, setOverrideReason] = useState(voteData?.tallyConfirmation?.overrideReason || '');
    const [isSaving, setIsSaving] = useState(false);
    const [meetingDetails, setMeetingDetails] = useState({
        title: '',
        heldAt: formatKoreanDate(new Date()),
        location: '',
        certificateDate: formatKoreanDate(new Date())
    });
    const [committeeMembers, setCommitteeMembers] = useState(DEFAULT_COMMITTEE_MEMBERS);
    const [sealImage, setSealImage] = useState(null);

    // Sync local state with global voteData when it's loaded or changed
    useEffect(() => {
        if (voteData?.tallyConfirmation) {
            const conf = voteData.tallyConfirmation;
            if (conf.meetingDetails) setMeetingDetails(conf.meetingDetails);
            if (conf.committeeMembers) setCommitteeMembers(conf.committeeMembers);
            if (conf.sealImage) setSealImage(conf.sealImage);
            if (conf.sourceType) setSourceType(conf.sourceType);
            if (conf.manualResults) setManualResults(conf.manualResults);
            if (conf.overrideReason) setOverrideReason(conf.overrideReason);
        }
    }, [voteData?.tallyConfirmation]);

    useEffect(() => {
        if (!selectedMeetingId && initialMeetingId) {
            setSelectedMeetingId(initialMeetingId);
        }
    }, [initialMeetingId, selectedMeetingId]);

    const selectedMeeting = useMemo(
        () => agendas.find((agenda) => agenda.id === selectedMeetingId && agenda.type === 'folder') || null,
        [agendas, selectedMeetingId]
    );

    useEffect(() => {
        if (!meetingDetails.title && selectedMeeting?.title) {
            setMeetingDetails((prev) => ({ ...prev, title: selectedMeeting.title }));
        }
    }, [meetingDetails.title, selectedMeeting]);`;

const replacement1 = `    const selectedMeeting = useMemo(
        () => agendas.find((agenda) => agenda.id === selectedMeetingId && agenda.type === 'folder') || null,
        [agendas, selectedMeetingId]
    );

    const initialConf = voteData?.tallyConfirmations?.[selectedMeetingId] || voteData?.tallyConfirmation;
    const [sourceType, setSourceType] = useState(initialConf?.sourceType || 'auto');
    const [manualResults, setManualResults] = useState(initialConf?.manualResults || {});
    const [overrideReason, setOverrideReason] = useState(initialConf?.overrideReason || '');
    const [isSaving, setIsSaving] = useState(false);
    const [meetingDetails, setMeetingDetails] = useState(initialConf?.meetingDetails || {
        title: selectedMeeting?.title || '',
        heldAt: formatKoreanDate(new Date()),
        location: '',
        certificateDate: formatKoreanDate(new Date())
    });
    const [committeeMembers, setCommitteeMembers] = useState(initialConf?.committeeMembers || DEFAULT_COMMITTEE_MEMBERS);
    const [sealImage, setSealImage] = useState(initialConf?.sealImage || null);

    // Sync local state when selectedMeetingId or voteData changes
    useEffect(() => {
        const conf = voteData?.tallyConfirmations?.[selectedMeetingId] || voteData?.tallyConfirmation;
        if (conf) {
            if (conf.meetingDetails) setMeetingDetails(conf.meetingDetails);
            if (conf.committeeMembers) setCommitteeMembers(conf.committeeMembers);
            if (conf.sealImage !== undefined) setSealImage(conf.sealImage);
            if (conf.sourceType) setSourceType(conf.sourceType);
            if (conf.manualResults) setManualResults(conf.manualResults);
            if (conf.overrideReason !== undefined) setOverrideReason(conf.overrideReason);
        } else {
            setMeetingDetails({
                title: selectedMeeting?.title || '',
                heldAt: formatKoreanDate(new Date()),
                location: '',
                certificateDate: formatKoreanDate(new Date())
            });
            setCommitteeMembers(DEFAULT_COMMITTEE_MEMBERS);
            setSealImage(null);
            setSourceType('auto');
            setManualResults({});
            setOverrideReason('');
        }
    }, [selectedMeetingId, voteData?.tallyConfirmations, voteData?.tallyConfirmation, selectedMeeting?.title]);

    useEffect(() => {
        if (!selectedMeetingId && initialMeetingId) {
            setSelectedMeetingId(initialMeetingId);
        }
    }, [initialMeetingId, selectedMeetingId]);

    useEffect(() => {
        if (!meetingDetails.title && selectedMeeting?.title) {
            setMeetingDetails((prev) => ({ ...prev, title: selectedMeeting.title }));
        }
    }, [meetingDetails.title, selectedMeeting]);`;

const target2 = `    const confirmation = voteData?.tallyConfirmation || null;`;
const replacement2 = `    const confirmation = voteData?.tallyConfirmations?.[selectedMeetingId] || voteData?.tallyConfirmation || null;`;

const target3 = `            await actions.updateVoteData('tallyConfirmation', payload);`;
const replacement3 = `            const updatedConfirmations = {
                ...(voteData.tallyConfirmations || {}),
                [selectedMeetingId]: payload
            };
            await actions.updateVoteData('tallyConfirmations', updatedConfirmations);`;


// Replace
function replaceContent(content, target, replacement) {
    const normTarget = target.replace(/\\r\\n/g, '\\n');
    let normContent = content.replace(/\\r\\n/g, '\\n');
    if (!normContent.includes(normTarget)) {
        console.error('Target not found:\n' + target.substring(0, 100));
        process.exit(1);
    }
    return normContent.replace(normTarget, replacement);
}

content = replaceContent(content, target1, replacement1);
content = replaceContent(content, target2, replacement2);
content = replaceContent(content, target3, replacement3);

fs.writeFileSync(filePath, content);
console.log('Successfully updated tally page for per-meeting saves');

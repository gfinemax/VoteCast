export const APP_NAME = 'VoteCast';
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || '0.0.0';
export const APP_COMMIT_COUNT = process.env.NEXT_PUBLIC_APP_COMMIT_COUNT || '';
export const APP_COMMIT_HASH = process.env.NEXT_PUBLIC_APP_COMMIT_HASH || '';
export const APP_RELEASE_CHANNEL = 'dev';
export const APP_RELEASE_LABEL = '개발 버전';
export const APP_DEV_NICKNAME = '태훈아빠';

const appCommitSuffix =
    APP_COMMIT_COUNT && APP_COMMIT_HASH
        ? `.${APP_COMMIT_COUNT}+${APP_COMMIT_HASH}`
        : '';

export const APP_DISPLAY_VERSION = `v${APP_VERSION}-${APP_RELEASE_CHANNEL}${appCommitSuffix}`;

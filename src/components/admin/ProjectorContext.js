'use client';

import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const ProjectorContext = createContext(null);

export function ProjectorProvider({ children }) {
    const [projectorWindowCount, setProjectorWindowCount] = useState(0);
    const projectorWindowsRef = useRef(new Map());

    const syncProjectorWindows = React.useCallback(() => {
        projectorWindowsRef.current.forEach((projectorWindow, windowId) => {
            if (!projectorWindow || projectorWindow.closed) {
                projectorWindowsRef.current.delete(windowId);
            }
        });

        setProjectorWindowCount(projectorWindowsRef.current.size);
    }, []);

    const openProjectorWindow = () => {
        syncProjectorWindows();

        const width = 1200;
        const height = 800;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;
        const windowId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        const projectorWindow = window.open(
            `/projector?windowId=${windowId}`,
            `VoteCastProjector-${windowId}`,
            `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
        );

        if (projectorWindow) {
            projectorWindowsRef.current.set(windowId, projectorWindow);
            setProjectorWindowCount(projectorWindowsRef.current.size);
            projectorWindow.focus();
        }
    };

    const broadcastCloseProjector = async () => {
        const channel = supabase.channel('projector_control');

        await channel.subscribe(async (status) => {
            if (status === 'SUBSCRIBED') {
                await channel.send({
                    type: 'broadcast',
                    event: 'close_projector',
                    payload: {},
                });
                supabase.removeChannel(channel);
            }
        });
    };

    const closeProjectorWindows = async () => {
        syncProjectorWindows();

        projectorWindowsRef.current.forEach((projectorWindow) => {
            try {
                projectorWindow?.close();
            } catch (error) {
                console.error('[ProjectorContext] Failed to close projector window:', error);
            }
        });

        projectorWindowsRef.current.clear();
        setProjectorWindowCount(0);

        await broadcastCloseProjector();
    };

    useEffect(() => {
        const cleanupInterval = window.setInterval(syncProjectorWindows, 1000);

        return () => {
            window.clearInterval(cleanupInterval);
        };
    }, [syncProjectorWindows]);

    const isProjectorOpen = projectorWindowCount > 0;

    return (
        <ProjectorContext.Provider
            value={{
                isProjectorOpen,
                projectorWindowCount,
                openProjectorWindow,
                closeProjectorWindow: closeProjectorWindows,
                closeProjectorWindows
            }}
        >
            {children}
        </ProjectorContext.Provider>
    );
}

export function useProjector() {
    const context = useContext(ProjectorContext);
    if (!context) {
        throw new Error('useProjector must be used within a ProjectorProvider');
    }
    return context;
}

'use client';

import React, { createContext, useContext, useState, useRef, useEffect } from 'react';
import { supabase } from '@/lib/supabase';

const ProjectorContext = createContext(null);

export function ProjectorProvider({ children }) {
    const [isProjectorOpen, setIsProjectorOpen] = useState(false);
    const projectorWindowRef = useRef(null);

    const openProjectorWindow = () => {
        // Check if window is already open and not closed
        if (projectorWindowRef.current && !projectorWindowRef.current.closed) {
            projectorWindowRef.current.focus();
            return;
        }

        const width = 1200;
        const height = 800;
        const left = (window.screen.width - width) / 2;
        const top = (window.screen.height - height) / 2;

        projectorWindowRef.current = window.open(
            '/projector',
            'VoteCastProjector',
            `width=${width},height=${height},left=${left},top=${top},menubar=no,toolbar=no,location=no,status=no`
        );

        if (projectorWindowRef.current) {
            setIsProjectorOpen(true);

            // Track when window is closed
            const checkClosed = setInterval(() => {
                if (projectorWindowRef.current?.closed) {
                    setIsProjectorOpen(false);
                    clearInterval(checkClosed);
                    projectorWindowRef.current = null;
                }
            }, 1000);
        }
    };

    const closeProjectorWindow = async () => {
        // 1. Close Local Ref if exists
        if (projectorWindowRef.current) {
            projectorWindowRef.current.close();
            projectorWindowRef.current = null;
            setIsProjectorOpen(false);
        }

        // 2. Send Broadcast to Remote Windows
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

    // Clean up on unmount (though this context is usually root)
    useEffect(() => {
        return () => {
            // Optional: Close projector on app close? 
            // Usually valid to keep it open, but we just lose the ref.
        };
    }, []);

    return (
        <ProjectorContext.Provider value={{ isProjectorOpen, openProjectorWindow, closeProjectorWindow }}>
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

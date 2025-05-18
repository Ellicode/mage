import {
    backgroundProcessHandler,
    clientProcessHandler,
    registerProcessComponent,
} from "../../kit/process";

interface Song {
    id: number;
    title: string;
    artist: string;
    url: string;
}

interface MusicState extends Song {
    playing: boolean;
    time: number;
    duration: number;
    audioElement?: HTMLAudioElement;
}

// Safely check for renderer environment
const isRenderer =
    typeof window !== "undefined" && typeof window.document !== "undefined";

// Use client or background process handler based on environment
const processHandler = isRenderer
    ? clientProcessHandler("com.ellicode.music")
    : backgroundProcessHandler("com.ellicode.music");

// Define browser API types safely
let audioElement: HTMLAudioElement | null = null;
let audioContext: AudioContext | null = null;
let audioAnalyser: AnalyserNode | null = null;
let audioDataURL: string | null = null;
let animationFrameId: number | null = null;

// Safe reference to Browser APIs
const Audio = isRenderer ? window.Audio : null;
const AudioContext = isRenderer
    ? window.AudioContext || (window as any).webkitAudioContext
    : null;
const URL = isRenderer ? window.URL : null;

// Set up audio visualization - client-side only
const setupVisualization = () => {
    if (!isRenderer || !audioAnalyser) return;

    const visualize = () => {
        // Get audio data once per frame
        const bufferLength = audioAnalyser!.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        audioAnalyser!.getByteFrequencyData(dataArray);

        // Better frequency band distribution
        const lowEnd = Math.floor(bufferLength * 0.15); // 0-15% for bass
        const midEnd = Math.floor(bufferLength * 0.5); // 15-50% for mids

        const bands = [
            dataArray.slice(0, lowEnd), // Bass frequencies
            dataArray.slice(lowEnd, midEnd), // Mid frequencies
            dataArray.slice(midEnd, bufferLength), // High frequencies
        ];

        // Calculate average for each band with improved scaling factors
        const averages = [
            bands[0].reduce((sum, val) => sum + val, 0) / bands[0].length,
            (bands[1].reduce((sum, val) => sum + val, 0) / bands[1].length) *
                2.0,
            (bands[2].reduce((sum, val) => sum + val, 0) / bands[2].length) *
                3.0,
        ];

        // Apply non-linear scaling to make small values more visible
        const scaledAverages = averages.map((avg) => {
            // Apply square root scaling to boost lower values
            return Math.pow(avg / 255, 0.5) * 255;
        });

        // Draw on each canvas
        const canvases = ["audio-visualizer", "live-activity-visualizer"];
        canvases.forEach((canvasId) => {
            const canvas = document.getElementById(
                canvasId
            ) as HTMLCanvasElement;
            if (!canvas) return;

            const ctx = canvas.getContext("2d");
            if (!ctx) return;

            // Clear canvas
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            // Set bar properties
            const numBars = 3; // Low, mid, high
            const barWidth = canvas.width / 5;
            const barGap = barWidth / 2;
            const barMaxHeight = canvas.height * 0.8;

            // Draw bars
            ctx.fillStyle = "#ff2056";
            for (let i = 0; i < numBars; i++) {
                const barHeight = Math.min(
                    (scaledAverages[i] / 255) * barMaxHeight,
                    barMaxHeight
                );

                const x = i * (barWidth + barGap) + barGap;
                const y = canvas.height - barHeight;

                ctx.fillRect(x, y, barWidth, barHeight);
            }
        });

        // Request next frame outside of the forEach loop
        animationFrameId = requestAnimationFrame(visualize);
    };

    animationFrameId = requestAnimationFrame(visualize);
};

const cleanupAudio = () => {
    if (animationFrameId && isRenderer) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    if (audioElement) {
        audioElement.pause();
        audioElement = null;
    }

    if (audioDataURL && URL && typeof URL.revokeObjectURL === "function") {
        URL.revokeObjectURL(audioDataURL);
        audioDataURL = null;
    }
};

// Function to create an audio element and play music
const createAndPlayAudio = async (
    url: string,
    songData: Song
): Promise<MusicState | null> => {
    if (!isRenderer) {
        console.log("Cannot play audio in non-renderer process");
        return null;
    }

    try {
        // Check that browser APIs are available
        if (!Audio || !AudioContext || !URL) {
            console.error("Required browser APIs not available");
            return null;
        }

        // Clean up any previous audio
        cleanupAudio();

        // Fetch and create audio from URL
        const response = await fetch(url);
        const blob = await response.blob();
        audioDataURL = URL.createObjectURL(blob);

        audioElement = new Audio(audioDataURL);

        // Set up audio context and analyzer for visualization
        if (!audioContext) {
            audioContext = new AudioContext();
        } else if (audioContext.state === "suspended") {
            await audioContext.resume();
        }

        if (!audioContext) {
            console.error("Failed to create audio context");
            return null;
        }

        const source = audioContext.createMediaElementSource(audioElement);
        audioAnalyser = audioContext.createAnalyser();
        audioAnalyser.fftSize = 128;
        source.connect(audioAnalyser);
        audioAnalyser.connect(audioContext.destination);

        // Play the audio
        await audioElement.play();

        // Start visualization
        setupVisualization();

        // Return the music state
        return {
            ...songData,
            time: 0,
            duration: audioElement.duration || 0,
            playing: true,
        };
    } catch (error) {
        console.error("Error playing audio:", error);
        return null;
    }
};

export const startMusic = async (song: Song) => {
    try {
        console.log("Starting music:", song.title);
        const processes = await processHandler.getProcesses();
        console.log("Current music processes:", processes);

        // If there are existing music processes, pause them
        if (processes.length > 0) {
            const existingProcess = processes.find((p) => p.name === "Music");
            if (existingProcess) {
                if ((existingProcess.data as Song).id === song.id) {
                    // Toggle pause/resume for same song
                    if (existingProcess.active) {
                        console.log("Pausing existing process");
                        await processHandler.pauseProcess(existingProcess.id);
                    } else {
                        console.log("Resuming existing process");
                        await processHandler.resumeProcess(existingProcess.id);
                    }
                    return;
                } else {
                    // Stop current song
                    console.log("Removing existing process to play new song");
                    await processHandler.removeProcess(existingProcess.id);
                }
            }
        }

        // Import and register the live activity component
        const liveActivityModule = await import("./LiveActivity.vue");
        const componentName = registerProcessComponent(
            `music-live-activity-${Date.now()}`,
            liveActivityModule.default
        );

        // Create a new process for the song
        console.log("Creating new music process");
        const newProcess = await processHandler.createProcess({
            name: "Music",
            data: song,
            liveActivityComponent: componentName, // Store component by name
            action: async (songData) => {
                if (isRenderer) {
                    const musicState = await createAndPlayAudio(
                        songData.url,
                        songData
                    );
                    console.log("Started playing:", musicState?.title);
                } else {
                    console.log(
                        "Music would play in background:",
                        songData.title
                    );
                }
            },
            pause: () => {
                if (audioElement) {
                    audioElement.pause();
                }
                console.log("Paused music:", song.title);
            },
            resume: () => {
                if (audioElement) {
                    audioElement.play();
                }
                console.log("Resumed music:", song.title);
            },
        });

        console.log("Created new process:", newProcess);

        // Force a notification of client process change
        if (isRenderer && window.ipcRenderer) {
            try {
                window.ipcRenderer.send("client-process-updated", {
                    type: "added",
                    process: {
                        id: newProcess.id,
                        name: newProcess.name,
                        appScheme: newProcess.appScheme,
                        liveActivityComponentName:
                            typeof newProcess.liveActivityComponent === "string"
                                ? newProcess.liveActivityComponent
                                : undefined,
                    },
                });
            } catch (e) {
                console.error("Failed to notify process update:", e);
            }
        }
    } catch (error) {
        console.error("Error starting music:", error);
    }
};

export const stopMusic = async () => {
    const processes = await processHandler.getProcesses();
    processes.forEach(async (process) => {
        if (process.name === "Music") {
            await processHandler.removeProcess(process.id);
        }
    });

    cleanupAudio();
};

export const toggleMusic = async (song: Song) => {
    const processes = await processHandler.getProcesses();
    const musicProcess = processes.find((p) => p.name === "Music");

    if (musicProcess) {
        const currentSong = musicProcess.data as Song;

        if (currentSong.id === song.id) {
            // Toggle playing state
            if (musicProcess.active) {
                await processHandler.pauseProcess(musicProcess.id);
            } else {
                await processHandler.resumeProcess(musicProcess.id);
            }
        } else {
            // Switch to new song
            await processHandler.removeProcess(musicProcess.id);
            await startMusic(song);
        }
    } else {
        // Start new song
        await startMusic(song);
    }
};

export const getCurrentMusicState = async (): Promise<MusicState | null> => {
    try {
        // Get processes directly from the handler
        const processes = await processHandler.getProcesses();
        console.log("Music processes:", processes.length);

        const musicProcess = processes.find((p) => p.name === "Music");

        if (musicProcess && musicProcess.data) {
            console.log("Found music process:", musicProcess.id);

            // Create a proper music state with all required fields
            const musicState = {
                ...(musicProcess.data as Song),
                playing: musicProcess.active,
                time: audioElement ? audioElement.currentTime : 0,
                duration: audioElement ? audioElement.duration || 0 : 0,
                audioElement: audioElement || undefined,
            } as MusicState;

            return musicState;
        } else {
            console.log("No active music process found");
        }
    } catch (error) {
        console.error("Error getting music state:", error);
    }

    return null;
};

// Add a new helper function to check if music is currently playing
export const isMusicPlaying = async (): Promise<boolean> => {
    const state = await getCurrentMusicState();
    return !!(state && state.playing);
};

import {
    backgroundProcessHandler,
    clientProcessHandler,
    registerProcessComponent,
} from "../../kit/process";

interface TimerState {
    initialTime: number; // Total time in seconds
    remainingTime: number; // Remaining time in seconds
    running: boolean;
    startTime?: number; // When the timer was started (timestamp)
    pauseTime?: number; // When the timer was paused (timestamp)
    endTime?: number; // When the timer should end (timestamp)
    alarmRinging?: boolean; // Whether the alarm is ringing
    muted?: boolean; // Whether the alarm is muted
}

// Safely check for renderer environment
const isRenderer =
    typeof window !== "undefined" && typeof window.document !== "undefined";

// Use client or background process handler based on environment
const processHandler = isRenderer
    ? clientProcessHandler("com.ellicode.timer")
    : backgroundProcessHandler("com.ellicode.timer");

// Global timer state
let timerInterval: ReturnType<typeof setInterval> | null = null;
let currentTimerState: TimerState | null = null;
let alarmAudio: HTMLAudioElement | null = null;
// Calculate total seconds from hours, minutes, seconds
export const calculateTotalSeconds = (
    hours: number,
    minutes: number,
    seconds: number
): number => {
    return hours * 3600 + minutes * 60 + seconds;
};

// Start a new timer
export const startTimer = async (
    hours: number,
    minutes: number,
    seconds: number
) => {
    try {
        console.log("Starting timer");
        const processes = await processHandler.getProcesses();

        // If there are existing timer processes, stop them
        if (processes.length > 0) {
            const existingProcess = processes.find((p) => p.name === "Timer");
            if (existingProcess) {
                await processHandler.removeProcess(existingProcess.id);
            }
        }

        // Calculate the total seconds for the timer
        const totalSeconds = calculateTotalSeconds(hours, minutes, seconds);
        if (totalSeconds <= 0) {
            console.log("Cannot start timer with 0 duration");
            return;
        }

        // Import and register the live activity component
        const liveActivityModule = await import("./LiveActivity.vue");
        const componentName = registerProcessComponent(
            `timer-live-activity-${Date.now()}`,
            liveActivityModule.default
        );

        // Initial timer state
        const initialTimerState: TimerState = {
            initialTime: totalSeconds,
            remainingTime: totalSeconds,
            running: true,
            startTime: Date.now(),
            endTime: Date.now() + totalSeconds * 1000,
            alarmRinging: false,
            muted: false, // Add muted flag
        }; // Create a new process for the timer
        console.log("Creating new timer process");
        const newProcess = await processHandler.createProcess({
            name: "Timer",
            data: initialTimerState,
            liveActivityComponent: componentName,
            // Custom method to toggle mute state
            toggleMute: function () {
                if (currentTimerState) {
                    currentTimerState.muted = !currentTimerState.muted;
                    console.log(
                        `Timer mute state: ${
                            currentTimerState.muted ? "muted" : "unmuted"
                        }`
                    );

                    if (currentTimerState.muted && alarmAudio) {
                        alarmAudio.pause();
                    } else if (
                        !currentTimerState.muted &&
                        alarmAudio &&
                        currentTimerState.alarmRinging
                    ) {
                        alarmAudio.play();
                    }

                    return currentTimerState.muted;
                }
                return false;
            },
            action: (timerData) => {
                if (isRenderer) {
                    currentTimerState = timerData;

                    // Start the countdown interval
                    if (timerInterval) clearInterval(timerInterval);

                    timerInterval = setInterval(() => {
                        if (!currentTimerState || !currentTimerState.running)
                            return;

                        const now = Date.now();
                        const endTime = currentTimerState.endTime || 0;
                        const remaining = Math.max(
                            0,
                            Math.ceil((endTime - now) / 1000)
                        );

                        currentTimerState.remainingTime = remaining;
                        if (remaining <= 0) {
                            // Timer completed
                            if (timerInterval) clearInterval(timerInterval);

                            // Play notification sound
                            if (isRenderer) {
                                (async () => {
                                    try {
                                        const response = await fetch(
                                            "./apps/com.ellicode.timer/assets/alarm.mp3"
                                        );
                                        const blob = await response.blob();
                                        const audioDataURL =
                                            URL.createObjectURL(blob);
                                        alarmAudio = new Audio(audioDataURL);
                                        await alarmAudio.play();
                                        alarmAudio.loop = true; // Loop the alarm sound

                                        if (currentTimerState) {
                                            currentTimerState.alarmRinging =
                                                true;

                                            // Get the active process to update its data
                                            const processes =
                                                await processHandler.getProcesses();
                                            const timerProcess = processes.find(
                                                (p) => p.name === "Timer"
                                            );

                                            if (timerProcess) {
                                                // Update the process data to include alarmRinging state
                                                timerProcess.data = {
                                                    ...timerProcess.data,
                                                    alarmRinging: true,
                                                    muted:
                                                        currentTimerState.muted ||
                                                        false,
                                                };
                                            }
                                        }
                                    } catch (error) {
                                        console.error(
                                            "Failed to play alarm:",
                                            error
                                        );
                                    }
                                })();
                            }

                            // Notify complete
                            console.log("Timer completed");
                        }
                    }, 1000);

                    console.log(
                        "Started timer:",
                        formatTimeString(totalSeconds)
                    );
                } else {
                    console.log("Timer would run in background");
                }
            },
            pause: () => {
                if (currentTimerState && currentTimerState.running) {
                    currentTimerState.running = false;
                    currentTimerState.pauseTime = Date.now();
                }
                console.log("Paused timer");
            },
            resume: () => {
                if (currentTimerState && !currentTimerState.running) {
                    // Update the end time based on the pause duration
                    if (
                        currentTimerState.pauseTime &&
                        currentTimerState.endTime
                    ) {
                        const pauseDuration =
                            Date.now() - currentTimerState.pauseTime;
                        currentTimerState.endTime += pauseDuration;
                    }

                    currentTimerState.running = true;
                    currentTimerState.pauseTime = undefined;
                }
                console.log("Resumed timer");
            },
        });

        console.log("Created new timer process:", newProcess);

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
        console.error("Error starting timer:", error);
    }
};

// Stop the timer
export const stopTimer = async () => {
    const processes = await processHandler.getProcesses();
    processes.forEach(async (process) => {
        if (process.name === "Timer") {
            await processHandler.removeProcess(process.id);
        }
    });
    if (alarmAudio) {
        alarmAudio.pause();
        alarmAudio.currentTime = 0; // Reset the audio
    }

    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }

    currentTimerState = null;
};

// Toggle the timer (pause/resume)
export const toggleTimer = async () => {
    const processes = await processHandler.getProcesses();
    const timerProcess = processes.find((p) => p.name === "Timer");

    if (timerProcess) {
        if (timerProcess.active) {
            await processHandler.pauseProcess(timerProcess.id);
        } else {
            await processHandler.resumeProcess(timerProcess.id);
        }
    }
};

// Get the current timer state
export const getCurrentTimerState = async (): Promise<TimerState | null> => {
    try {
        const processes = await processHandler.getProcesses();
        const timerProcess = processes.find((p) => p.name === "Timer");

        if (timerProcess && timerProcess.data) {
            // Create a proper timer state
            return {
                ...timerProcess.data,
                running: timerProcess.active,
            };
        }
    } catch (error) {
        console.error("Error getting timer state:", error);
    }

    return null;
};

// Helper function to format time
export const formatTimeString = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours.toString().padStart(2, "0")}:${minutes
        .toString()
        .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
};

// Check if timer is running
export const isTimerRunning = async (): Promise<boolean> => {
    const state = await getCurrentTimerState();
    return !!(state && state.running);
};

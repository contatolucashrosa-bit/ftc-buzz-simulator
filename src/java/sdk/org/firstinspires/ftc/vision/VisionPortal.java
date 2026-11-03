// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.firstinspires.ftc.vision;

import android.util.Size;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.buzzsim.internal.SimAprilTagProcessor;
import org.firstinspires.ftc.robotcore.external.hardware.camera.BuiltinCameraDirection;
import org.firstinspires.ftc.robotcore.external.hardware.camera.CameraName;
import org.firstinspires.ftc.robotcore.external.hardware.camera.controls.CameraControl;
import org.firstinspires.ftc.robotcore.external.hardware.camera.controls.ExposureControl;
import org.firstinspires.ftc.robotcore.external.hardware.camera.controls.GainControl;

/** Portal de visão do simulador: liga a câmera do robô aos processadores, sem imagem ao vivo. */
public abstract class VisionPortal {
    public static final int DEFAULT_VIEW_CONTAINER_ID = 0;

    public enum StreamFormat { YUY2, MJPEG }

    public enum MultiPortalLayout { VERTICAL, HORIZONTAL }

    public enum CameraState { OPENING_CAMERA_DEVICE, CAMERA_DEVICE_READY, STARTING_STREAM, STREAMING, STOPPING_STREAM, CAMERA_DEVICE_CLOSED, CLOSING_CAMERA_DEVICE, ERROR }

    public static VisionPortal easyCreateWithDefaults(CameraName camera, VisionProcessor... processors) {
        return new Builder().setCamera(camera).addProcessors(processors).build();
    }

    public static int[] makeMultiPortalView(int numPortals, MultiPortalLayout layout) {
        int[] ids = new int[numPortals];
        for (int i = 0; i < numPortals; i++) ids[i] = i + 1;
        return ids;
    }

    public static class Builder {
        private final List<VisionProcessor> processors = new ArrayList<>();
        private Size resolution = new Size(640, 480);
        private boolean autoStart = true;

        public Builder setCamera(CameraName camera) { return this; }
        public Builder setCamera(BuiltinCameraDirection cameraDirection) { return this; }
        public Builder setStreamFormat(StreamFormat streamFormat) { return this; }
        public Builder enableLiveView(boolean enableLiveView) { return this; }
        public Builder setLiveViewContainerId(int liveViewContainerId) { return this; }
        public Builder setAutoStopLiveView(boolean autoPause) { return this; }
        public Builder setShowStatsOverlay(boolean showStatsOverlay) { return this; }
        public Builder setAutoStartStreamOnBuild(boolean autoStart) { this.autoStart = autoStart; return this; }
        public Builder setCameraResolution(Size cameraResolution) { resolution = cameraResolution; return this; }
        public Builder addProcessor(VisionProcessor processor) { processors.add(processor); return this; }
        public Builder addProcessors(VisionProcessor... processors) {
            for (VisionProcessor p : processors) this.processors.add(p);
            return this;
        }

        public VisionPortal build() {
            if (processors.isEmpty()) throw new RuntimeException("Cannot create a VisionPortal without any processors!");
            return new SimPortal(processors, resolution, autoStart);
        }
    }

    public abstract void setProcessorEnabled(VisionProcessor processor, boolean enabled);
    public abstract boolean getProcessorEnabled(VisionProcessor processor);
    public abstract CameraState getCameraState();
    public abstract void saveNextFrameRaw(String filename);
    public abstract void stopStreaming();
    public abstract void resumeStreaming();
    public abstract void stopLiveView();
    public abstract void resumeLiveView();
    public abstract float getFps();
    public abstract <T extends CameraControl> T getCameraControl(Class<T> controlType);
    public abstract void setActiveCamera(org.firstinspires.ftc.robotcore.external.hardware.camera.WebcamName webcamName);
    public abstract org.firstinspires.ftc.robotcore.external.hardware.camera.WebcamName getActiveCamera();
    public abstract void close();

    private static final class SimPortal extends VisionPortal {
        private final List<VisionProcessor> processors;
        private boolean streaming;
        private boolean closed = false;
        private final List<Boolean> wanted = new ArrayList<>();

        SimPortal(List<VisionProcessor> processors, Size resolution, boolean autoStart) {
            this.processors = processors;
            this.streaming = autoStart;
            for (VisionProcessor p : processors) {
                wanted.add(true);
                if (p instanceof SimAprilTagProcessor) ((SimAprilTagProcessor) p).attach(resolution.getWidth(), resolution.getHeight());
            }
            apply();
        }

        /** Um processador só detecta com a câmera transmitindo e ele ligado. */
        private void apply() {
            for (int i = 0; i < processors.size(); i++) {
                VisionProcessor p = processors.get(i);
                if (p instanceof SimAprilTagProcessor) ((SimAprilTagProcessor) p).setEnabled(streaming && !closed && wanted.get(i));
            }
        }

        @Override public void setProcessorEnabled(VisionProcessor processor, boolean enabled) {
            int i = processors.indexOf(processor);
            if (i < 0) throw new IllegalArgumentException("Processor not attached to this portal");
            wanted.set(i, enabled);
            apply();
        }

        @Override public boolean getProcessorEnabled(VisionProcessor processor) {
            int i = processors.indexOf(processor);
            return i >= 0 && wanted.get(i);
        }

        @Override public CameraState getCameraState() {
            if (closed) return CameraState.CAMERA_DEVICE_CLOSED;
            return streaming ? CameraState.STREAMING : CameraState.CAMERA_DEVICE_READY;
        }

        @Override public void saveNextFrameRaw(String filename) {}
        @Override public void stopStreaming() { streaming = false; apply(); }
        @Override public void resumeStreaming() { streaming = true; apply(); }
        @Override public void stopLiveView() {}
        @Override public void resumeLiveView() {}
        @Override public float getFps() { return streaming && !closed ? 30f : 0f; }

        @Override
        @SuppressWarnings("unchecked")
        public <T extends CameraControl> T getCameraControl(Class<T> controlType) {
            if (controlType == ExposureControl.class) return (T) new SimExposure();
            if (controlType == GainControl.class) return (T) new SimGain();
            return null;
        }

        @Override public void setActiveCamera(org.firstinspires.ftc.robotcore.external.hardware.camera.WebcamName webcamName) {}
        @Override public org.firstinspires.ftc.robotcore.external.hardware.camera.WebcamName getActiveCamera() { return null; }
        @Override public void close() { closed = true; apply(); }
    }

    /** A câmera simulada não tem borrão nem ruído: exposição e ganho são aceitos e guardados, sem efeito na detecção. */
    private static final class SimExposure implements ExposureControl {
        private Mode mode = Mode.Auto;
        private long exposureMs = 15;
        private boolean aePriority = false;

        @Override public Mode getMode() { return mode; }
        @Override public boolean setMode(Mode mode) { this.mode = mode; return true; }
        @Override public boolean isModeSupported(Mode mode) { return mode == Mode.Auto || mode == Mode.Manual; }
        @Override public long getMinExposure(TimeUnit resultUnit) { return resultUnit.convert(1, TimeUnit.MILLISECONDS); }
        @Override public long getMaxExposure(TimeUnit resultUnit) { return resultUnit.convert(204, TimeUnit.MILLISECONDS); }
        @Override public long getExposure(TimeUnit resultUnit) { return resultUnit.convert(exposureMs, TimeUnit.MILLISECONDS); }
        @Override public boolean setExposure(long duration, TimeUnit durationUnit) { exposureMs = TimeUnit.MILLISECONDS.convert(duration, durationUnit); return true; }
        @Override public boolean isExposureSupported() { return true; }
        @Override public boolean getAePriority() { return aePriority; }
        @Override public boolean setAePriority(boolean priority) { aePriority = priority; return true; }
    }

    private static final class SimGain implements GainControl {
        private int gain = 100;

        @Override public int getMinGain() { return 0; }
        @Override public int getMaxGain() { return 255; }
        @Override public int getGain() { return gain; }
        @Override public boolean setGain(int gain) { this.gain = gain; return true; }
    }
}

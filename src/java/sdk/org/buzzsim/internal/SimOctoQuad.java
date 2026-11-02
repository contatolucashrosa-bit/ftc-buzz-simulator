// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.buzzsim.internal;

import com.qualcomm.hardware.digitalchickenlabs.OctoQuad;

/** OctoQuad no modo localizador, com a odometria ideal do simulador. */
public final class SimOctoQuad implements OctoQuad {
    private final String name;
    private final Odometry odometry;

    public SimOctoQuad(String name) {
        this.name = name;
        this.odometry = new Odometry(name);
    }

    @Override public Manufacturer getManufacturer() { return Manufacturer.DigitalChickenLabs; }
    @Override public String getDeviceName() { return "OctoQuad " + name; }
    @Override public String getConnectionInfo() { return "Buzz Simulator; " + name; }
    @Override public int getVersion() { return 1; }
    @Override public void resetDeviceConfigurationForOpMode() {}
    @Override public void close() {}
    @Override public void setSingleEncoderDirection(int idx, EncoderDirection direction) {}
    @Override public void setLocalizerPortX(int port) {}
    @Override public void setLocalizerPortY(int port) {}
    @Override public void setLocalizerCountsPerMM_X(float ticksPerMm) {}
    @Override public void setLocalizerCountsPerMM_Y(float ticksPerMm) {}
    @Override public void setLocalizerTcpOffsetMM_X(float mm) {}
    @Override public void setLocalizerTcpOffsetMM_Y(float mm) {}
    @Override public void setLocalizerImuHeadingScalar(float scalar) {}
    @Override public void setLocalizerVelocityIntervalMS(int ms) {}
    @Override public void setAllLocalizerParameters(int portX, int portY, float cpmmX, float cpmmY, float tcpX, float tcpY, float headingScalar, int velocityIntervalMs) {}

    @Override
    public void readLocalizerData(LocalizerDataBlock out) {
        odometry.update();
        out.localizerStatus = LocalizerStatus.RUNNING;
        out.crcOk = true;
        out.heading_rad = (float) odometry.h;
        out.posX_mm = (short) Math.round(odometry.x);
        out.posY_mm = (short) Math.round(odometry.y);
        out.velX_mmS = (short) Math.round(odometry.vx);
        out.velY_mmS = (short) Math.round(odometry.vy);
        out.velHeading_radS = (float) odometry.vh;
    }

    @Override
    public LocalizerDataBlock readLocalizerData() {
        LocalizerDataBlock block = new LocalizerDataBlock();
        readLocalizerData(block);
        return block;
    }

    @Override public void readLocalizerDataAndAllEncoderData(LocalizerDataBlock localizer, EncoderDataBlock encoders) { readLocalizerData(localizer); }
    @Override public void setLocalizerPose(int posX_mm, int posY_mm, float heading_rad) { odometry.setPose(posX_mm, posY_mm, heading_rad); }
    @Override public void setLocalizerHeading(float heading_rad) { odometry.update(); odometry.setPose(odometry.x, odometry.y, heading_rad); }
    @Override public LocalizerStatus getLocalizerStatus() { return LocalizerStatus.RUNNING; }
    @Override public void resetLocalizerAndCalibrateIMU() { odometry.reset(); }
    @Override public void setI2cRecoveryMode(I2cRecoveryMode mode) {}
}

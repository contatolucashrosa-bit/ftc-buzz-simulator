// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package com.qualcomm.hardware.digitalchickenlabs;

import com.qualcomm.robotcore.hardware.HardwareDevice;

public interface OctoQuad extends HardwareDevice {
    byte OCTOQUAD_CHIP_ID = 0x51;
    int SUPPORTED_FW_VERSION_MAJ = 3;
    int ENCODER_FIRST = 0;
    int ENCODER_LAST = 7;
    int NUM_ENCODERS = 8;
    int MIN_VELOCITY_MEASUREMENT_INTERVAL_MS = 1;
    int MAX_VELOCITY_MEASUREMENT_INTERVAL_MS = 255;
    int MIN_PULSE_WIDTH_US = 0;
    int MAX_PULSE_WIDTH_US = 0xFFFF;

    enum EncoderDirection { FORWARD, REVERSE }
    enum I2cRecoveryMode { NONE, MODE_1_PERIPH_RST_ON_FRAME_ERR, MODE_2_M1_PLUS_SCL_IDLE_ONESHOT_TGL }
    enum LocalizerStatus { INVALID, NOT_INITIALIZED, WARMING_UP_IMU, CALIBRATING_IMU, RUNNING, FAULT_NO_IMU }
    enum LocalizerYawAxis { UNDECIDED, X, X_INV, Y, Y_INV, Z, Z_INV }

    class LocalizerDataBlock {
        public LocalizerStatus localizerStatus = LocalizerStatus.NOT_INITIALIZED;
        public boolean crcOk;
        public float heading_rad;
        public short posX_mm;
        public short posY_mm;
        public short velX_mmS;
        public short velY_mmS;
        public float velHeading_radS;

        public LocalizerDataBlock() {}

        public boolean isDataValid() {
            return crcOk && localizerStatus == LocalizerStatus.RUNNING;
        }
    }

    class EncoderDataBlock {
        public int[] positions = new int[NUM_ENCODERS];
        public short[] velocities = new short[NUM_ENCODERS];
        public boolean crcOk = true;

        public EncoderDataBlock() {}

        public boolean isDataValid() {
            return crcOk;
        }
    }

    void setSingleEncoderDirection(int idx, EncoderDirection direction);
    void setLocalizerPortX(int port);
    void setLocalizerPortY(int port);
    void setLocalizerCountsPerMM_X(float ticksPerMm);
    void setLocalizerCountsPerMM_Y(float ticksPerMm);
    void setLocalizerTcpOffsetMM_X(float mm);
    void setLocalizerTcpOffsetMM_Y(float mm);
    void setLocalizerImuHeadingScalar(float scalar);
    void setLocalizerVelocityIntervalMS(int ms);
    void setAllLocalizerParameters(int portX, int portY, float cpmmX, float cpmmY, float tcpX, float tcpY, float headingScalar, int velocityIntervalMs);
    void readLocalizerData(LocalizerDataBlock out);
    LocalizerDataBlock readLocalizerData();
    void readLocalizerDataAndAllEncoderData(LocalizerDataBlock localizer, EncoderDataBlock encoders);
    void setLocalizerPose(int posX_mm, int posY_mm, float heading_rad);
    void setLocalizerHeading(float heading_rad);
    LocalizerStatus getLocalizerStatus();
    void resetLocalizerAndCalibrateIMU();
    void setI2cRecoveryMode(I2cRecoveryMode mode);
}

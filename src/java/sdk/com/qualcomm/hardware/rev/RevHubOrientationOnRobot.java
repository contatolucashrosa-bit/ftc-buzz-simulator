// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package com.qualcomm.hardware.rev;

import com.qualcomm.robotcore.hardware.ImuOrientationOnRobot;
import org.firstinspires.ftc.robotcore.external.navigation.AngleUnit;
import org.firstinspires.ftc.robotcore.external.navigation.AxesOrder;
import org.firstinspires.ftc.robotcore.external.navigation.AxesReference;
import org.firstinspires.ftc.robotcore.external.navigation.Orientation;
import org.firstinspires.ftc.robotcore.external.navigation.Quaternion;

/** Orientação do Hub no robô. No simulador o IMU já mede o giro do robô, então o valor só é guardado. */
public class RevHubOrientationOnRobot implements ImuOrientationOnRobot {
    public enum LogoFacingDirection { UP, DOWN, FORWARD, BACKWARD, LEFT, RIGHT }
    public enum UsbFacingDirection { UP, DOWN, FORWARD, BACKWARD, LEFT, RIGHT }

    public RevHubOrientationOnRobot(LogoFacingDirection logo, UsbFacingDirection usb) {
        if (logo.ordinal() / 2 == usb.ordinal() / 2) {
            throw new IllegalArgumentException("The two provided directions are not perpendicular");
        }
    }

    public RevHubOrientationOnRobot(Orientation orientation) {}
    public RevHubOrientationOnRobot(Quaternion quaternion) {}

    public static Orientation zyxOrientation(double z, double y, double x) {
        return new Orientation(AxesReference.INTRINSIC, AxesOrder.ZYX, AngleUnit.DEGREES, (float) z, (float) y, (float) x, 0);
    }

    public static Orientation xyzOrientation(double x, double y, double z) {
        return new Orientation(AxesReference.INTRINSIC, AxesOrder.XYZ, AngleUnit.DEGREES, (float) x, (float) y, (float) z, 0);
    }

    @Override public Quaternion angularVelocityTransform() { return Quaternion.identityQuaternion(); }
    @Override public Quaternion imuRotationOffset() { return Quaternion.identityQuaternion(); }
    @Override public Quaternion imuCoordinateSystemOrientationFromPerspectiveOfRobot() { return Quaternion.identityQuaternion(); }
}

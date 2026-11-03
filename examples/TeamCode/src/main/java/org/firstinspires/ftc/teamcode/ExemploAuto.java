// Buzz Simulator — exemplo de autônomo. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Sai da largada com encoder (RUN_TO_POSITION), liga o lançador, lança os elementos pré-carregados e estaciona.
package org.firstinspires.ftc.teamcode;

import com.qualcomm.robotcore.eventloop.opmode.Autonomous;
import com.qualcomm.robotcore.eventloop.opmode.LinearOpMode;
import com.qualcomm.robotcore.hardware.DcMotor;
import com.qualcomm.robotcore.hardware.DcMotorEx;
import com.qualcomm.robotcore.hardware.DcMotorSimple;
import com.qualcomm.robotcore.hardware.IMU;
import com.qualcomm.robotcore.hardware.Servo;
import com.qualcomm.robotcore.util.ElapsedTime;
import org.firstinspires.ftc.robotcore.external.navigation.AngleUnit;

@Autonomous(name = "Exemplo: lançar e estacionar", group = "Exemplos")
public class ExemploAuto extends LinearOpMode {
    private DcMotor[] drive;

    @Override
    public void runOpMode() {
        drive = new DcMotor[] {
            hardwareMap.get(DcMotor.class, "leftFront"),
            hardwareMap.get(DcMotor.class, "leftBack"),
            hardwareMap.get(DcMotor.class, "rightFront"),
            hardwareMap.get(DcMotor.class, "rightBack"),
        };
        drive[0].setDirection(DcMotorSimple.Direction.REVERSE);
        drive[1].setDirection(DcMotorSimple.Direction.REVERSE);
        DcMotorEx launcher = hardwareMap.get(DcMotorEx.class, "launcher");
        Servo feeder = hardwareMap.get(Servo.class, "feeder");
        Servo hood = hardwareMap.get(Servo.class, "hood");
        IMU imu = hardwareMap.get(IMU.class, "imu");
        imu.resetYaw();
        hood.setPosition(0.4);

        telemetry.addLine("Exemplo de AUTO pronto");
        telemetry.update();
        waitForStart();

        // 1. anda 24 pol para a frente (rodas de 104 mm, 537,7 ticks por volta)
        driveTicks((int) (24 * 25.4 / (Math.PI * 104) * 537.7), 0.6);

        // 2. liga o lançador e espera ele chegar na velocidade
        launcher.setMode(DcMotor.RunMode.RUN_USING_ENCODER);
        launcher.setVelocity(2100);
        ElapsedTime timer = new ElapsedTime();
        while (opModeIsActive() && launcher.getVelocity() < 2000 && timer.seconds() < 3) {
            telemetry.addData("Lançador", "%.0f ticks/s", launcher.getVelocity());
            telemetry.update();
        }

        // 3. lança 4 vezes
        for (int i = 0; i < 4 && opModeIsActive(); i++) {
            feeder.setPosition(1);
            sleep(250);
            feeder.setPosition(0);
            sleep(350);
            telemetry.addData("Lançados", i + 1);
            telemetry.addData("Ângulo (IMU)", "%.1f°", imu.getRobotYawPitchRollAngles().getYaw(AngleUnit.DEGREES));
            telemetry.update();
        }
        launcher.setVelocity(0);

        // 4. volta para estacionar
        driveTicks(-(int) (20 * 25.4 / (Math.PI * 104) * 537.7), 0.6);
        telemetry.addLine("Fim do AUTO");
        telemetry.update();
    }

    private void driveTicks(int ticks, double power) {
        for (DcMotor m : drive) {
            m.setMode(DcMotor.RunMode.STOP_AND_RESET_ENCODER);
            m.setTargetPosition(ticks);
            m.setMode(DcMotor.RunMode.RUN_TO_POSITION);
            m.setPower(power);
        }
        while (opModeIsActive() && drive[0].isBusy()) {
            telemetry.addData("Andando", "%d de %d ticks", drive[0].getCurrentPosition(), ticks);
            telemetry.update();
        }
        for (DcMotor m : drive) m.setPower(0);
    }
}

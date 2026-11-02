// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package com.qualcomm.robotcore.hardware;

import com.qualcomm.hardware.digitalchickenlabs.OctoQuad;
import com.qualcomm.hardware.gobilda.GoBildaPinpointDriver;
import com.qualcomm.hardware.lynx.LynxModule;
import com.qualcomm.hardware.sparkfun.SparkFunOTOS;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.SortedSet;
import java.util.TreeSet;
import org.buzzsim.internal.Hw;
import org.buzzsim.internal.SimCRServo;
import org.buzzsim.internal.SimDevices;
import org.buzzsim.internal.SimImu;
import org.buzzsim.internal.SimMotor;
import org.buzzsim.internal.SimOctoQuad;
import org.buzzsim.internal.SimServo;

/** Mapa de hardware do robô simulado. Os nomes vêm da configuração do robô no simulador. */
public class HardwareMap implements Iterable<HardwareDevice> {
    public static class DeviceMapping<DEVICE_TYPE extends HardwareDevice> implements Iterable<DEVICE_TYPE> {
        private final Class<DEVICE_TYPE> deviceTypeClass;
        private final Map<String, DEVICE_TYPE> map = new LinkedHashMap<>();
        private HardwareMap owner;
        private String kind;

        public DeviceMapping(Class<DEVICE_TYPE> deviceTypeClass) {
            this.deviceTypeClass = deviceTypeClass;
        }

        DeviceMapping<DEVICE_TYPE> bind(HardwareMap owner, String kind) {
            this.owner = owner;
            this.kind = kind;
            return this;
        }

        public Class<DEVICE_TYPE> getDeviceTypeClass() { return deviceTypeClass; }

        @SuppressWarnings("unchecked")
        public DEVICE_TYPE cast(Object obj) { return (DEVICE_TYPE) obj; }

        public DEVICE_TYPE get(String deviceName) {
            DEVICE_TYPE device = map.get(deviceName);
            if (device == null && owner != null) {
                device = owner.get(deviceTypeClass, deviceName);
                map.put(deviceName, device);
            }
            return device;
        }

        public void put(String deviceName, DEVICE_TYPE device) { map.put(deviceName, device); }
        public void putLocal(String deviceName, DEVICE_TYPE device) { map.put(deviceName, device); }
        public boolean contains(String deviceName) { return map.containsKey(deviceName) || (owner != null && kind != null && !Hw.kind(deviceName).isEmpty()); }
        public boolean remove(String deviceName) { return map.remove(deviceName) != null; }

        private void loadAll() {
            if (owner == null || kind == null) return;
            String names = Hw.names(kind);
            if (names == null || names.isEmpty()) return;
            for (String n : names.split(",")) if (!map.containsKey(n)) get(n);
        }

        @Override public Iterator<DEVICE_TYPE> iterator() { loadAll(); return new ArrayList<>(map.values()).iterator(); }
        public Set<Map.Entry<String, DEVICE_TYPE>> entrySet() { loadAll(); return map.entrySet(); }
        public int size() { loadAll(); return map.size(); }
    }

    private static final List<SimMotor> ALL_MOTORS = new ArrayList<>();

    public DeviceMapping<DcMotorController> dcMotorController = new DeviceMapping<>(DcMotorController.class);
    public DeviceMapping<DcMotor> dcMotor = new DeviceMapping<>(DcMotor.class).bind(this, "motor");
    public DeviceMapping<ServoController> servoController = new DeviceMapping<>(ServoController.class);
    public DeviceMapping<Servo> servo = new DeviceMapping<>(Servo.class).bind(this, "servo");
    public DeviceMapping<CRServo> crservo = new DeviceMapping<>(CRServo.class).bind(this, "crservo");
    public DeviceMapping<AnalogInput> analogInput = new DeviceMapping<>(AnalogInput.class).bind(this, "analog");
    public DeviceMapping<DigitalChannel> digitalChannel = new DeviceMapping<>(DigitalChannel.class).bind(this, "digital");
    public DeviceMapping<TouchSensor> touchSensor = new DeviceMapping<>(TouchSensor.class).bind(this, "touch");
    public DeviceMapping<VoltageSensor> voltageSensor = new DeviceMapping<>(VoltageSensor.class).bind(this, "voltage");
    public final List<DeviceMapping<? extends HardwareDevice>> allDeviceMappings = new ArrayList<>();
    public final Object appContext = null;

    private final Map<String, HardwareDevice> cache = new HashMap<>();
    private final LynxModule hub = new LynxModule();

    public HardwareMap(Object context, Object notifier) {
        // Como no robô real, o sensor de tensão do Control Hub sempre existe.
        voltageSensor.put("Control Hub", SimDevices.voltage());
        allDeviceMappings.add(dcMotor);
        allDeviceMappings.add(servo);
        allDeviceMappings.add(crservo);
        allDeviceMappings.add(voltageSensor);
    }

    /** Para os motores ao fim do OpMode, como o Control Hub. */
    public static void stopAllMotors() {
        for (SimMotor m : ALL_MOTORS) m.internalStop();
    }

    private static boolean isMotorType(Class<?> c) {
        return c == DcMotor.class || c == DcMotorEx.class || c == DcMotorSimple.class;
    }

    private HardwareDevice create(Class<?> type, String name) {
        String kind = Hw.kind(name);
        if (type == LynxModule.class) return hub;
        if (type == VoltageSensor.class) return SimDevices.voltage();
        if (kind.isEmpty()) return null;
        if (isMotorType(type) || type == HardwareDevice.class && kind.equals("motor")) {
            if (!kind.equals("motor")) return null;
            SimMotor m = new SimMotor(name);
            ALL_MOTORS.add(m);
            return m;
        }
        if (type == CRServo.class) return kind.equals("crservo") || kind.equals("servo") ? new SimCRServo(name) : null;
        if (type == Servo.class) return kind.equals("servo") ? new SimServo(name) : null;
        if (type == IMU.class) return kind.equals("imu") ? new SimImu(name) : null;
        if (type == GoBildaPinpointDriver.class) return kind.equals("odometry") ? new GoBildaPinpointDriver(name) : null;
        if (type == SparkFunOTOS.class) return kind.equals("odometry") ? new SparkFunOTOS(name) : null;
        if (type == OctoQuad.class) return kind.equals("odometry") ? new SimOctoQuad(name) : null;
        if (type == DistanceSensor.class) return kind.equals("distance") ? SimDevices.distance(name) : null;
        if (type == TouchSensor.class) return kind.equals("touch") ? SimDevices.touch(name) : null;
        if (type == AnalogInput.class) return kind.equals("analog") ? new AnalogInput(name) : null;
        if (type == DigitalChannel.class) return kind.equals("touch") || kind.equals("digital") ? SimDevices.digital(name) : null;
        return null;
    }

    @SuppressWarnings("unchecked")
    public <T> T get(Class<? extends T> classOrInterface, String deviceName) {
        T result = tryGet(classOrInterface, deviceName);
        if (result == null) {
            throw new IllegalArgumentException("Unable to find a hardware device with name \"" + deviceName + "\" and type " + classOrInterface.getSimpleName());
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    public <T> T tryGet(Class<? extends T> classOrInterface, String deviceName) {
        String key = classOrInterface.getName() + "#" + deviceName;
        HardwareDevice device = cache.get(key);
        if (device == null) {
            device = create(classOrInterface, deviceName);
            if (device != null) cache.put(key, device);
        }
        return (T) device;
    }

    public HardwareDevice get(String deviceName) {
        String kind = Hw.kind(deviceName);
        switch (kind) {
            case "motor": return get(DcMotorEx.class, deviceName);
            case "servo": return get(Servo.class, deviceName);
            case "crservo": return get(CRServo.class, deviceName);
            case "imu": return get(IMU.class, deviceName);
            case "odometry": return get(GoBildaPinpointDriver.class, deviceName);
            default: throw new IllegalArgumentException("Unable to find a hardware device with name \"" + deviceName + "\"");
        }
    }

    @SuppressWarnings("unchecked")
    public <T> List<T> getAll(Class<? extends T> classOrInterface) {
        List<T> list = new ArrayList<>();
        if (classOrInterface == LynxModule.class) {
            list.add((T) hub);
        } else if (classOrInterface == VoltageSensor.class) {
            list.add((T) SimDevices.voltage());
        } else if (isMotorType(classOrInterface)) {
            for (DcMotor m : dcMotor) list.add((T) m);
        } else if (classOrInterface == Servo.class) {
            for (Servo s : servo) list.add((T) s);
        }
        return list;
    }

    public SortedSet<String> getAllNames(Class<? extends HardwareDevice> classOrInterface) {
        SortedSet<String> names = new TreeSet<>();
        String kind = isMotorType(classOrInterface) ? "motor" : classOrInterface == Servo.class ? "servo" : classOrInterface == IMU.class ? "imu" : "";
        String all = kind.isEmpty() ? "" : Hw.names(kind);
        if (all != null && !all.isEmpty()) for (String n : all.split(",")) names.add(n);
        return names;
    }

    public Set<String> getNamesOf(HardwareDevice device) {
        Set<String> names = new java.util.HashSet<>();
        for (Map.Entry<String, HardwareDevice> e : cache.entrySet()) {
            if (e.getValue() == device) names.add(e.getKey().substring(e.getKey().indexOf('#') + 1));
        }
        if (device == hub) names.add("Control Hub");
        return names;
    }

    public void put(String deviceName, HardwareDevice device) { cache.put(deviceName, device); }
    public boolean remove(String deviceName, HardwareDevice device) { return cache.remove(deviceName) != null; }
    public int size() { return cache.size(); }
    @Override public Iterator<HardwareDevice> iterator() { return new ArrayList<>(cache.values()).iterator(); }
    public Iterable<HardwareDevice> unsafeIterable() { return cache.values(); }
    public void logDevices() {}
}

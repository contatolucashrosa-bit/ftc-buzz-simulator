// Buzz Simulator — SDK FTC simulado. Criado por Lucas Hochmann Rosa (https://github.com/contatolucashrosa-bit), em parceria com WestSharksFTC #24823.
// Implementação própria; só as assinaturas públicas seguem o SDK oficial (FTC SDK 12.0), para o código das equipes compilar sem mudanças.
package org.buzzsim.internal;

import java.util.ArrayList;
import java.util.List;
import org.firstinspires.ftc.robotcore.external.Func;
import org.firstinspires.ftc.robotcore.external.Telemetry;

/** Telemetria mostrada no painel do simulador (no lugar do Driver Station). */
public final class SimTelemetry implements Telemetry {
    private final List<Object> lines = new ArrayList<>();
    private final List<String> logLines = new ArrayList<>();
    private boolean autoClear = true;
    private String itemSeparator = " | ";
    private String captionSeparator = " : ";
    private int msTransmission = 250;
    private int logCapacity = 9;

    final class SimItem implements Item {
        String caption;
        String format;
        Object[] args;
        Object value;
        Func<?> producer;
        boolean retained;
        final List<SimItem> children = new ArrayList<>();

        SimItem(String caption) {
            this.caption = caption;
        }

        String render() {
            StringBuilder sb = new StringBuilder();
            sb.append(caption).append(captionSeparator).append(valueText());
            for (SimItem child : children) sb.append(itemSeparator).append(child.render());
            return sb.toString();
        }

        String valueText() {
            Object v = producer != null ? producer.value() : value;
            if (format != null) {
                try {
                    Object[] a = producer != null ? new Object[] {v} : args;
                    return String.format(format, a);
                } catch (RuntimeException e) {
                    return format;
                }
            }
            return String.valueOf(v);
        }

        @Override public String getCaption() { return caption; }
        @Override public Item setCaption(String caption) { this.caption = caption; return this; }
        @Override public Item setValue(String format, Object... args) { this.format = format; this.args = args; this.producer = null; return this; }
        @Override public Item setValue(Object value) { this.value = value; this.format = null; this.producer = null; return this; }
        @Override public <T> Item setValue(Func<T> func) { this.producer = func; this.format = null; return this; }
        @Override public <T> Item setValue(String format, Func<T> func) { this.producer = func; this.format = format; return this; }
        @Override public Item setRetained(Boolean retained) { this.retained = retained != null && retained; return this; }
        @Override public boolean isRetained() { return retained; }
        @Override public Item addData(String caption, String format, Object... args) { SimItem i = new SimItem(caption); i.setValue(format, args); children.add(i); return i; }
        @Override public Item addData(String caption, Object value) { SimItem i = new SimItem(caption); i.setValue(value); children.add(i); return i; }
        @Override public <T> Item addData(String caption, Func<T> func) { SimItem i = new SimItem(caption); i.setValue(func); children.add(i); return i; }
        @Override public <T> Item addData(String caption, String format, Func<T> func) { SimItem i = new SimItem(caption); i.setValue(format, func); children.add(i); return i; }
    }

    final class SimLine implements Line {
        final String text;
        final List<SimItem> items = new ArrayList<>();

        SimLine(String text) {
            this.text = text;
        }

        String render() {
            StringBuilder sb = new StringBuilder(text);
            for (int k = 0; k < items.size(); k++) {
                if (sb.length() > 0) sb.append(itemSeparator);
                sb.append(items.get(k).render());
            }
            return sb.toString();
        }

        @Override public Item addData(String caption, String format, Object... args) { SimItem i = new SimItem(caption); i.setValue(format, args); items.add(i); return i; }
        @Override public Item addData(String caption, Object value) { SimItem i = new SimItem(caption); i.setValue(value); items.add(i); return i; }
        @Override public <T> Item addData(String caption, Func<T> func) { SimItem i = new SimItem(caption); i.setValue(func); items.add(i); return i; }
        @Override public <T> Item addData(String caption, String format, Func<T> func) { SimItem i = new SimItem(caption); i.setValue(format, func); items.add(i); return i; }
    }

    private final Log log = new Log() {
        @Override public int getCapacity() { return logCapacity; }
        @Override public void setCapacity(int capacity) { logCapacity = capacity; }
        @Override public DisplayOrder getDisplayOrder() { return DisplayOrder.OLDEST_FIRST; }
        @Override public void setDisplayOrder(DisplayOrder order) {}
        @Override public void add(String entry) {
            logLines.add(entry);
            while (logLines.size() > logCapacity) logLines.remove(0);
        }
        @Override public void add(String format, Object... args) { add(String.format(format, args)); }
        @Override public void clear() { logLines.clear(); }
    };

    private SimItem item(String caption) {
        SimItem i = new SimItem(caption);
        lines.add(i);
        return i;
    }

    @Override public Item addData(String caption, String format, Object... args) { return item(caption).setValue(format, args); }
    @Override public Item addData(String caption, Object value) { return item(caption).setValue(value); }
    @Override public <T> Item addData(String caption, Func<T> func) { return item(caption).setValue(func); }
    @Override public <T> Item addData(String caption, String format, Func<T> func) { return item(caption).setValue(format, func); }
    @Override public boolean removeItem(Item item) { return lines.remove(item); }
    @Override public void clear() {
        List<Object> keep = new ArrayList<>();
        for (Object o : lines) if (o instanceof SimItem && ((SimItem) o).retained) keep.add(o);
        lines.clear();
        lines.addAll(keep);
    }
    @Override public void clearAll() { lines.clear(); logLines.clear(); }
    @Override public Object addAction(Runnable action) { return action; }
    @Override public boolean removeAction(Object token) { return true; }
    @Override public void speak(String text) {}
    @Override public void speak(String text, String languageCode, String countryCode) {}

    @Override public boolean update() {
        StringBuilder sb = new StringBuilder();
        for (Object o : lines) {
            String text = o instanceof SimItem ? ((SimItem) o).render() : ((SimLine) o).render();
            sb.append(text).append('\n');
        }
        for (String l : logLines) sb.append(l).append('\n');
        Hw.telemetry(sb.toString());
        if (autoClear) clear();
        return true;
    }

    @Override public Line addLine() { return addLine(""); }
    @Override public Line addLine(String text) { SimLine l = new SimLine(text); lines.add(l); return l; }
    @Override public boolean removeLine(Line line) { return lines.remove(line); }
    @Override public boolean isAutoClear() { return autoClear; }
    @Override public void setAutoClear(boolean autoClear) { this.autoClear = autoClear; }
    @Override public int getMsTransmissionInterval() { return msTransmission; }
    @Override public void setMsTransmissionInterval(int ms) { msTransmission = ms; }
    @Override public String getItemSeparator() { return itemSeparator; }
    @Override public void setItemSeparator(String s) { itemSeparator = s; }
    @Override public String getCaptionValueSeparator() { return captionSeparator; }
    @Override public void setCaptionValueSeparator(String s) { captionSeparator = s; }
    @Override public void setDisplayFormat(DisplayFormat format) {}
    @Override public Log log() { return log; }
}

// Assinaturas mínimas das anotações do TeaVM, só para compilar o SDK com o JDK local (o TeaVM real as substitui no navegador).
package org.teavm.interop;
import java.lang.annotation.*;
@Retention(RetentionPolicy.CLASS) @Target(ElementType.METHOD)
public @interface Async {}

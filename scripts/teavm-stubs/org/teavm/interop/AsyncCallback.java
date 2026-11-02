// Assinaturas mínimas das anotações do TeaVM, só para compilar o SDK com o JDK local (o TeaVM real as substitui no navegador).
package org.teavm.interop;
public interface AsyncCallback<T> { void complete(T result); void error(Throwable e); }

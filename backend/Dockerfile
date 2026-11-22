# Backend container for cloud hosting (e.g. Render). Build: docker build -t medbilling-backend ./backend
FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /app
COPY pom.xml .
RUN mvn -q -B dependency:go-offline
COPY src src
RUN mvn -q -B package -DskipTests

FROM eclipse-temurin:21-jre
WORKDIR /app
COPY --from=build /app/target/*.jar app.jar
# Hosting platforms pass the port in $PORT; fall back to 8081 locally.
# SPRING_PROFILES_ACTIVE (e.g. "demo") and the other settings come from the platform's environment variables.
# Render free instances have 512 MB: keep heap + metaspace + threads well inside it
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=60 -XX:+UseSerialGC -XX:TieredStopAtLevel=1 -Xss512k"
EXPOSE 8081
CMD ["sh", "-c", "SERVER_PORT=${PORT:-8081} exec java -jar app.jar"]

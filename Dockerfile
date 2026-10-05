# Full application under one origin: session cookies work without third-party cookies.
FROM node:22-bookworm-slim AS frontend
WORKDIR /frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
ENV VITE_API_BASE_URL=""
RUN npm run build

FROM eclipse-temurin:21-jdk-jammy AS backend
WORKDIR /app
COPY backend/.mvn/ .mvn/
COPY backend/mvnw backend/pom.xml ./
RUN sed -i 's/\r$//' mvnw && chmod +x mvnw
COPY backend/src/ src/
COPY --from=frontend /frontend/dist/ src/main/resources/static/
RUN ./mvnw -B -ntp verify

FROM eclipse-temurin:21-jre-jammy
WORKDIR /app
COPY --from=backend /app/target/*.jar app.jar
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=60.0 -XX:+ExitOnOutOfMemoryError"
USER 10001:10001
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "app.jar"]

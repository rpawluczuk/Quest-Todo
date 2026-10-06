package pl.questtodo.auth;

import java.util.Locale;
import jakarta.servlet.DispatcherType;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import pl.questtodo.user.UserRepository;

@Configuration
public class SecurityConfiguration {
    @Bean
    org.springframework.security.core.session.SessionRegistry sessionRegistry() {
        return new org.springframework.security.core.session.SessionRegistryImpl();
    }

    @Bean
    org.springframework.security.web.session.HttpSessionEventPublisher sessionEvents() {
        return new org.springframework.security.web.session.HttpSessionEventPublisher();
    }

    @Bean
    PasswordEncoder passwordEncoder() {
        return new BCryptPasswordEncoder(12);
    }

    @Bean
    UserDetailsService userDetailsService(UserRepository users) {
        return login -> {
            var account = users.findByLogin(login.strip().toLowerCase(Locale.ROOT))
                    .orElseThrow(() -> new UsernameNotFoundException("Invalid credentials"));
            return User.withUsername(Long.toString(account.toUser().id()))
                    .password(account.getPasswordHash()).roles("USER").build();
        };
    }

    @Bean
    SecurityFilterChain securityFilterChain(HttpSecurity http,
            org.springframework.security.core.session.SessionRegistry sessions) throws Exception {
        return http
                .cors(Customizer.withDefaults())
                .csrf(Customizer.withDefaults())
                .requestCache(cache -> cache.disable())
                .sessionManagement(session -> session.maximumSessions(-1).sessionRegistry(sessions)
                        .expiredSessionStrategy(event -> event.getResponse().setStatus(401)))
                .authorizeHttpRequests(auth -> auth
                        .dispatcherTypeMatchers(DispatcherType.ERROR).permitAll()
                        .requestMatchers(HttpMethod.GET, "/api/health", "/api/auth/csrf").permitAll()
                        .requestMatchers(HttpMethod.POST, "/api/auth/register", "/api/auth/email/confirm").permitAll()
                        .requestMatchers("/api/**").authenticated()
                        .requestMatchers(HttpMethod.GET, "/", "/index.html", "/assets/**", "/favicon.svg", "/icons.svg").permitAll()
                        .anyRequest().denyAll())
                .formLogin(form -> form
                        .loginProcessingUrl("/api/auth/login")
                        .successHandler((request, response, authentication) -> response.setStatus(204))
                        .failureHandler((request, response, exception) -> response.setStatus(401))
                        .permitAll())
                .logout(logout -> logout.logoutUrl("/api/auth/logout")
                        .invalidateHttpSession(true).clearAuthentication(true)
                        .deleteCookies("JSESSIONID")
                        .logoutSuccessHandler((request, response, authentication) -> response.setStatus(204)))
                .exceptionHandling(errors -> errors
                        .authenticationEntryPoint((request, response, exception) -> response.setStatus(401))
                        .accessDeniedHandler((request, response, exception) -> response.setStatus(403)))
                .build();
    }
}

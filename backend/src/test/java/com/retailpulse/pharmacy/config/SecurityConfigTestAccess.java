package com.retailpulse.pharmacy.config;

import java.util.List;

import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.jwt.Jwt;

/** Exposes the package-private azp validator to tests in other packages. */
public final class SecurityConfigTestAccess {

    private SecurityConfigTestAccess() {
    }

    public static OAuth2TokenValidator<Jwt> azp(List<String> origins) {
        return SecurityConfig.authorizedPartyValidator(origins);
    }
}

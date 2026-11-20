package com.retailpulse.pharmacy;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class PharmacyBackendApplication {

	public static void main(String[] args) {
		SpringApplication.run(PharmacyBackendApplication.class, args);
		System.out.println("Backend Started");
	}

}


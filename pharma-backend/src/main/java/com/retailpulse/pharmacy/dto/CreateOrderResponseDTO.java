package com.retailpulse.pharmacy.dto;

public class CreateOrderResponseDTO {
    private String orderId;
    private int amount;
    private String currency;
    private String keyId;
    private boolean mock;

    public String getOrderId() { return orderId; }
    public void setOrderId(String orderId) { this.orderId = orderId; }
    public int getAmount() { return amount; }
    public void setAmount(int amount) { this.amount = amount; }
    public String getCurrency() { return currency; }
    public void setCurrency(String currency) { this.currency = currency; }
    public String getKeyId() { return keyId; }
    public void setKeyId(String keyId) { this.keyId = keyId; }
    public boolean isMock() { return mock; }
    public void setMock(boolean mock) { this.mock = mock; }
}

package com.opsto91.aimentor;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(LocalAiPlugin.class);
        super.onCreate(savedInstanceState);
    }
}

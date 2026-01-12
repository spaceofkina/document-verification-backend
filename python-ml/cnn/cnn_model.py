# python-ml/cnn/cnn_model.py
import tensorflow as tf
from tensorflow import keras
from tensorflow.keras import layers

def create_philippine_document_cnn(num_classes=11):
    """Create CNN for Philippine document classification"""
    model = keras.Sequential([
        # Layer 1: Convolutional
        layers.Conv2D(32, (3, 3), activation='relu', padding='same',
                     input_shape=(224, 224, 3),
                     name='conv1_document_classification'),
        
        # Layer 2: Max Pooling
        layers.MaxPooling2D((2, 2), name='pool1'),
        
        # Layer 3: Convolutional
        layers.Conv2D(64, (3, 3), activation='relu', padding='same',
                     name='conv2_feature_extraction'),
        
        # Layer 4: Max Pooling
        layers.MaxPooling2D((2, 2), name='pool2'),
        
        # Layer 5: Flatten
        layers.Flatten(name='flatten_features'),
        
        # Layer 6: Dense
        layers.Dense(128, activation='relu', name='dense1_ph_features'),
        
        # Layer 7: Dropout
        layers.Dropout(0.5, name='dropout_regularization'),
        
        # Layer 8: Output
        layers.Dense(num_classes, activation='softmax',
                    name='output_ph_document_types')
    ])
    
    # Compile
    model.compile(
        optimizer=keras.optimizers.Adam(learning_rate=0.001),
        loss='sparse_categorical_crossentropy',
        metrics=['accuracy']
    )
    
    return model
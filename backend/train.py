import os
import numpy as np
import librosa
from sklearn.model_selection import train_test_split
import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Dense, Dropout

def extract_features(file_path):
    """
    Extract MFCC features from an audio file.
    Return an array of MFCC features averaged over time.
    """
    try:
        # Load audio data
        audio, sample_rate = librosa.load(file_path, sr=16000)
        # Extract MFCC features
        mfccs = librosa.feature.mfcc(y=audio, sr=sample_rate, n_mfcc=40)
        mfccs_scaled = np.mean(mfccs.T, axis=0)
        return mfccs_scaled
    except Exception as e:
        safe_name = file_path.encode('ascii', 'ignore').decode('ascii')
        print(f"Skipping file {safe_name} - cannot be processed (might be unsupported format like .m4a without ffmpeg)")
        return None

def main():
    print("====================================")
    print("   DeepShield Audio ML Training     ")
    print("====================================")
    
    dataset_path = 'dataset'
    real_path = os.path.join(dataset_path, 'real')
    fake_path = os.path.join(dataset_path, 'fake')

    features = []
    labels = []

    # Check if dataset directories exist
    if not os.path.exists(real_path) or not os.path.exists(fake_path):
        print("ERROR: Please create 'dataset/real' and 'dataset/fake' directories and add your .wav/.mp3 files.")
        return

    real_files = os.listdir(real_path)
    fake_files = os.listdir(fake_path)

    if len(real_files) == 0 and len(fake_files) == 0:
        print("ERROR: Your dataset folders are empty! Please put audio files in them before training.")
        return

    print("Extracting features from REAL audio...")
    for filename in real_files:
        file_path = os.path.join(real_path, filename)
        if os.path.isfile(file_path):
            data = extract_features(file_path)
            if data is not None:
                features.append(data)
                labels.append(1) # REAL is 1

    print("Extracting features from FAKE audio...")
    for filename in fake_files:
        file_path = os.path.join(fake_path, filename)
        if os.path.isfile(file_path):
            data = extract_features(file_path)
            if data is not None:
                features.append(data)
                labels.append(0) # FAKE is 0

    if len(features) == 0:
        print("ERROR: No valid audio files found in the dataset directories.")
        return

    # Convert to NumPy arrays
    X = np.array(features)
    y = np.array(labels)

    # Split for validation (80% train, 20% test)
    # If the dataset is too small, this might throw an error, so we handle it gracefully
    if len(X) < 5:
        print("WARNING: You have a very tiny dataset. Using placeholder split. Please add more files!")
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.1, random_state=42)
    else:
        X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

    # Build the Neural Network Model
    print("Building model architecture...")
    model = Sequential([
        Dense(256, activation='relu', input_shape=(40,)),
        Dropout(0.5),
        Dense(128, activation='relu'),
        Dropout(0.5),
        Dense(64, activation='relu'),
        Dropout(0.5),
        Dense(1, activation='sigmoid') # Sigmoid for binary classification (Real=1 / Fake=0)
    ])

    model.compile(loss='binary_crossentropy', metrics=['accuracy'], optimizer='adam')

    print("Training model... (This will take a few moments depending on dataset size)")
    # 50 Epochs is a good starting point
    model.fit(X_train, y_train, batch_size=32, epochs=50, validation_data=(X_test, y_test), verbose=1)

    # Save the model
    model_save_path = 'deepfake_model.h5'
    model.save(model_save_path)
    print(f"\n====================================")
    print(f"SUCCESS: Model saved to {model_save_path}!")
    print(f"The backend will now automatically use this model for predictions.")
    print("====================================")

if __name__ == '__main__':
    main()

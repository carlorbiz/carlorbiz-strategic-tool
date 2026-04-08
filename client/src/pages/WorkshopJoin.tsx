import { useEffect, useState, useRef } from 'react';
import { useParams } from 'wouter';
import { supabase } from '@/lib/supabase';
import { Camera, Upload, Check, Loader2, AlertTriangle } from 'lucide-react';

export default function WorkshopJoin() {
  const { accessToken } = useParams<{ accessToken: string }>();
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadedCount, setUploadedCount] = useState(0);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!supabase || !accessToken) {
      setLoading(false);
      return;
    }

    const loadSession = async () => {
      const { data } = await supabase!
        .from('workshop_sessions')
        .select('id, name, client_name, status')
        .eq('access_token', accessToken)
        .single();

      if (data) {
        setSession(data);
      } else {
        setError('Workshop session not found or has expired.');
      }
      setLoading(false);
    };

    loadSession();
  }, [accessToken]);

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !supabase || !session) return;
    setUploading(true);
    setError('');

    let successCount = 0;

    for (const file of Array.from(files)) {
      // Validate file size (16MB limit)
      if (file.size > 16 * 1024 * 1024) {
        setError(`File "${file.name}" exceeds 16MB limit.`);
        continue;
      }

      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError(`File "${file.name}" is not an image.`);
        continue;
      }

      try {
        // Upload to Supabase Storage
        const fileName = `${session.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${file.name}`;
        const { data: storageData, error: storageError } = await supabase.storage
          .from('workshop-photos')
          .upload(fileName, file, { contentType: file.type });

        if (storageError) throw storageError;

        // Get public URL
        const { data: urlData } = supabase.storage
          .from('workshop-photos')
          .getPublicUrl(fileName);

        // Create database record
        await supabase.from('workshop_photos').insert({
          session_id: session.id,
          image_url: urlData.publicUrl,
          storage_path: fileName,
          uploaded_by_name: 'Workshop Participant',
          ocr_status: 'pending',
        });

        successCount++;
      } catch (err: any) {
        console.error('Upload error:', err);
        setError(`Failed to upload "${file.name}": ${err.message}`);
      }
    }

    setUploadedCount((prev) => prev + successCount);
    setUploading(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="text-center max-w-md">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h2 className="font-heading text-xl font-bold text-foreground mb-2">Session Not Found</h2>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="bg-primary text-primary-foreground px-4 py-4 text-center">
        <h1 className="font-heading font-bold text-lg">{session?.name || 'Workshop'}</h1>
        <p className="text-sm opacity-80">{session?.client_name || 'Upload your photos'}</p>
      </header>

      {/* Upload Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-8">
        {uploadedCount > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6 flex items-center gap-3 max-w-sm w-full">
            <Check className="w-5 h-5 text-green-600 shrink-0" />
            <p className="text-sm text-green-800">
              {uploadedCount} photo{uploadedCount !== 1 ? 's' : ''} uploaded successfully!
            </p>
          </div>
        )}

        {error && session && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 max-w-sm w-full">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        <div className="max-w-sm w-full space-y-4">
          {/* Camera capture */}
          <button
            onClick={() => cameraInputRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-3 px-6 py-6 bg-primary text-primary-foreground rounded-xl font-medium text-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Camera className="w-6 h-6" />
            )}
            Take Photo
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />

          {/* Gallery upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full flex items-center justify-center gap-3 px-6 py-6 border-2 border-dashed border-border text-foreground rounded-xl font-medium text-lg hover:bg-muted transition-colors disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Upload className="w-6 h-6" />
            )}
            Choose from Gallery
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => handleUpload(e.target.files)}
          />
        </div>

        <p className="text-xs text-muted-foreground mt-6 text-center max-w-xs">
          Upload photos of sticky notes, whiteboards, or other workshop materials. Images are
          processed with OCR to extract text automatically.
        </p>
      </main>
    </div>
  );
}

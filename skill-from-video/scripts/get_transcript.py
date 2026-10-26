#!/usr/bin/env python3
import argparse
import json
import sys

try:
    from youtube_transcript_api import YouTubeTranscriptApi
    from youtube_transcript_api.formatters import TextFormatter
except ImportError:
    print("Error: youtube-transcript-api not installed", file=sys.stderr)
    print("Install with: pip install youtube-transcript-api", file=sys.stderr)
    sys.exit(1)

def get_transcript(video_id, lang='en'):
    try:
        transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
        try:
            transcript = transcript_list.find_transcript([lang])
        except:
            transcript = transcript_list.find_transcript(['en'])
        
        data = transcript.fetch()
        formatter = TextFormatter()
        text = formatter.format_transcript(data)
        
        # Also get with timestamps
        formatted = []
        for entry in data:
            formatted.append({
                'start': entry['start'],
                'duration': entry['duration'],
                'text': entry['text']
            })
        
        return {
            'text': text,
            'timestamped': formatted,
            'language': transcript.language_code
        }
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        return None

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Get YouTube transcript")
    parser.add_argument("video_id", help="YouTube video ID")
    parser.add_argument("-l", "--lang", default="en", help="Language code")
    parser.add_argument("-j", "--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()
    
    result = get_transcript(args.video_id, args.lang)
    if not result:
        sys.exit(1)
    
    if args.json:
        print(json.dumps(result, indent=2))
    else:
        print(result['text'])

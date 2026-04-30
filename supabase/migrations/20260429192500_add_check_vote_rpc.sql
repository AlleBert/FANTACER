-- RPC check_can_vote: Allows frontend to check status based on fingerprint
CREATE OR REPLACE FUNCTION check_can_vote(fingerprint_param TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN NOT EXISTS (
    SELECT 1 FROM votes 
    WHERE fingerprint = fingerprint_param 
    AND created_at::DATE = CURRENT_DATE
  );
END;
$$;

// Explore oqs-sys structure
extern crate oqs_sys;

fn main() {
    // Try to access signature-related types
    println!("Checking oqs_sys structure...");
    
    // Check if sig module exists
    use oqs_sys::sig;
    
    // Try different import patterns
    println!("OQS_STATUS enum: {:?}", oqs_sys::sig::OQS_STATUS::OQS_SUCCESS);
    
    // Check for functions
    // Note: Can't actually call unsafe functions here, just checking they exist
    println!("Functions should be in oqs_sys::sig module");
}